import hashlib
import logging
import re
from typing import Dict, List, Optional, Tuple
from urllib.parse import urlparse, urljoin
import requests
from bs4 import BeautifulSoup
import trafilatura
from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeoutError

logger = logging.getLogger(__name__)


class WebScraperService:
    """
    Service for scraping content from websites.
    Supports both static HTML and JavaScript-rendered content.
    """
    
    def __init__(self, timeout: int = 30, user_agent: str = "Atlas-AI-Bot/1.0"):
        self.timeout = timeout
        self.user_agent = user_agent
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': user_agent,
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
        })
    
    def validate_url(self, url: str) -> bool:
        """Validate URL format and prevent SSRF attacks."""
        try:
            parsed = urlparse(url)
            # Only allow http and https
            if parsed.scheme not in ['http', 'https']:
                return False
            # Prevent localhost and private IPs (basic SSRF protection)
            hostname = parsed.hostname or ''
            if hostname in ['localhost', '127.0.0.1', '0.0.0.0']:
                return False
            if hostname.startswith('192.168.') or hostname.startswith('10.') or hostname.startswith('172.'):
                return False
            return True
        except Exception as e:
            logger.error(f"URL validation error: {e}")
            return False
    
    def get_url_hash(self, url: str) -> str:
        """Generate MD5 hash from URL for document ID."""
        return hashlib.md5(url.encode('utf-8')).hexdigest()
    
    def scrape_static(self, url: str) -> Tuple[str, Dict]:
        """
        Scrape static HTML content from a URL.
        Returns: (text_content, metadata_dict)
        """
        try:
            logger.info(f"Scraping static content from: {url}")
            response = self.session.get(url, timeout=self.timeout)
            response.raise_for_status()
            
            # Check content size (limit to 5MB)
            max_size = 5 * 1024 * 1024  # 5MB
            if len(response.content) > max_size:
                raise ValueError(f"Content size ({len(response.content)} bytes) exceeds 5MB limit")
            
            html_content = response.text
            
            # Use trafilatura for main content extraction
            text_content = trafilatura.extract(html_content, include_comments=False, include_tables=True)
            
            if not text_content or not text_content.strip():
                # Fallback to BeautifulSoup if trafilatura fails
                logger.warning("Trafilatura extraction failed, using BeautifulSoup fallback")
                text_content = self._extract_with_bs4(html_content)
            
            # Extract metadata
            metadata = self._extract_metadata(html_content, url)
            
            return text_content.strip(), metadata
            
        except requests.exceptions.RequestException as e:
            logger.error(f"Error scraping static content from {url}: {e}")
            raise
        except Exception as e:
            logger.error(f"Unexpected error scraping {url}: {e}")
            raise
    
    def scrape_dynamic(self, url: str) -> Tuple[str, Dict]:
        """
        Scrape JavaScript-rendered content using Playwright.
        Returns: (text_content, metadata_dict)
        """
        try:
            logger.info(f"Scraping dynamic content from: {url}")
            
            with sync_playwright() as p:
                # Launch browser (headless mode)
                browser = p.chromium.launch(headless=True)
                context = browser.new_context(
                    user_agent=self.user_agent,
                    viewport={'width': 1920, 'height': 1080}
                )
                page = context.new_page()
                
                try:
                    # Navigate to URL with timeout
                    page.goto(url, wait_until='networkidle', timeout=self.timeout * 1000)
                    
                    # Wait a bit for any lazy-loaded content
                    page.wait_for_timeout(2000)
                    
                    # Get page content
                    html_content = page.content()
                    
                    # Extract text using trafilatura
                    text_content = trafilatura.extract(html_content, include_comments=False, include_tables=True)
                    
                    if not text_content or not text_content.strip():
                        # Fallback to extracting from body
                        text_content = page.evaluate("() => document.body.innerText")
                    
                    # Extract metadata
                    metadata = self._extract_metadata_from_page(page, url)
                    
                    return text_content.strip(), metadata
                    
                except PlaywrightTimeoutError:
                    logger.warning(f"Timeout while scraping {url}, trying to get partial content")
                    html_content = page.content()
                    text_content = trafilatura.extract(html_content, include_comments=False, include_tables=True)
                    if not text_content:
                        text_content = page.evaluate("() => document.body.innerText")
                    metadata = self._extract_metadata_from_page(page, url)
                    return text_content.strip(), metadata
                    
                finally:
                    browser.close()
                    
        except Exception as e:
            logger.error(f"Error scraping dynamic content from {url}: {e}")
            raise
    
    def scrape(self, url: str, use_dynamic: bool = False) -> Tuple[str, Dict]:
        """
        Main scraping method. Tries static first, falls back to dynamic if needed.
        
        Args:
            url: URL to scrape
            use_dynamic: Force use of dynamic scraping (Playwright)
        
        Returns:
            Tuple of (text_content, metadata_dict)
        """
        if not self.validate_url(url):
            raise ValueError(f"Invalid or unsafe URL: {url}")
        
        if use_dynamic:
            return self.scrape_dynamic(url)
        
        try:
            # Try static first (faster)
            return self.scrape_static(url)
        except Exception as e:
            logger.warning(f"Static scraping failed for {url}: {e}. Trying dynamic scraping...")
            # Fallback to dynamic if static fails
            try:
                return self.scrape_dynamic(url)
            except Exception as e2:
                logger.error(f"Both static and dynamic scraping failed for {url}: {e2}")
                raise
    
    def _extract_with_bs4(self, html_content: str) -> str:
        """Fallback content extraction using BeautifulSoup."""
        soup = BeautifulSoup(html_content, 'lxml')
        
        # Remove script and style elements
        for script in soup(["script", "style", "nav", "footer", "header", "aside"]):
            script.decompose()
        
        # Try to find main content
        main_content = soup.find('main') or soup.find('article') or soup.find('div', class_=re.compile(r'content|main|article', re.I))
        
        if main_content:
            text = main_content.get_text(separator=' ', strip=True)
        else:
            # Fallback to body
            body = soup.find('body')
            text = body.get_text(separator=' ', strip=True) if body else ""
        
        # Clean up whitespace
        text = re.sub(r'\s+', ' ', text)
        return text.strip()
    
    def _extract_metadata(self, html_content: str, url: str) -> Dict:
        """Extract metadata from HTML content."""
        soup = BeautifulSoup(html_content, 'lxml')
        metadata = {
            'url': url,
            'title': '',
            'description': '',
            'author': '',
            'publish_date': '',
            'images': [],
            'links': [],
        }
        
        # Extract title
        title_tag = soup.find('title')
        if title_tag:
            metadata['title'] = title_tag.get_text(strip=True)
        
        # Extract meta description
        meta_desc = soup.find('meta', attrs={'name': 'description'}) or soup.find('meta', attrs={'property': 'og:description'})
        if meta_desc:
            metadata['description'] = meta_desc.get('content', '')
        
        # Extract Open Graph title
        og_title = soup.find('meta', attrs={'property': 'og:title'})
        if og_title:
            metadata['title'] = og_title.get('content', metadata['title'])
        
        # Extract author
        author_tag = soup.find('meta', attrs={'name': 'author'}) or soup.find('meta', attrs={'property': 'article:author'})
        if author_tag:
            metadata['author'] = author_tag.get('content', '')
        
        # Extract publish date
        date_tag = soup.find('meta', attrs={'property': 'article:published_time'}) or soup.find('time')
        if date_tag:
            metadata['publish_date'] = date_tag.get('content') or date_tag.get('datetime', '')
        
        # Extract images
        images = []
        for img in soup.find_all('img', src=True):
            img_url = img.get('src')
            if img_url:
                # Convert relative URLs to absolute
                img_url = urljoin(url, img_url)
                images.append(img_url)
        metadata['images'] = images[:10]  # Limit to 10 images
        
        # Extract links
        links = []
        for link in soup.find_all('a', href=True):
            link_url = link.get('href')
            if link_url:
                link_url = urljoin(url, link_url)
                links.append({
                    'url': link_url,
                    'text': link.get_text(strip=True)[:100]  # Limit text length
                })
        metadata['links'] = links[:20]  # Limit to 20 links
        
        return metadata
    
    def _extract_metadata_from_page(self, page, url: str) -> Dict:
        """Extract metadata from Playwright page object."""
        metadata = {
            'url': url,
            'title': '',
            'description': '',
            'author': '',
            'publish_date': '',
            'images': [],
            'links': [],
        }
        
        try:
            # Get title
            metadata['title'] = page.title() or ''
            
            # Get meta tags
            meta_description = page.query_selector('meta[name="description"], meta[property="og:description"]')
            if meta_description:
                metadata['description'] = meta_description.get_attribute('content') or ''
            
            og_title = page.query_selector('meta[property="og:title"]')
            if og_title:
                metadata['title'] = og_title.get_attribute('content') or metadata['title']
            
            # Get images
            images = page.query_selector_all('img[src]')
            for img in images[:10]:
                src = img.get_attribute('src')
                if src:
                    img_url = urljoin(url, src)
                    metadata['images'].append(img_url)
            
            # Get links
            links = page.query_selector_all('a[href]')
            for link in links[:20]:
                href = link.get_attribute('href')
                text = link.inner_text()[:100] if link.inner_text() else ''
                if href:
                    link_url = urljoin(url, href)
                    metadata['links'].append({
                        'url': link_url,
                        'text': text
                    })
                    
        except Exception as e:
            logger.warning(f"Error extracting metadata from page: {e}")
        
        return metadata
    
    def get_document_info(self, url: str, metadata: Dict) -> Dict[str, str]:
        """Generate document info similar to PDFService.get_document_info."""
        parsed = urlparse(url)
        title = metadata.get('title', '')
        if not title:
            # Try to extract from URL
            title = parsed.path.split('/')[-1] or parsed.netloc
        
        # Create a safe filename from URL
        safe_path = parsed.path.replace('/', '_').replace('\\', '_')[:50]
        if not safe_path:
            safe_path = 'index'
        filename = f"{parsed.netloc}_{safe_path}.html"
        
        return {
            'title': title,
            'filename': filename,
            'file_path': url,  # Store URL as file_path for web sources
            'source_url': url,
        }
