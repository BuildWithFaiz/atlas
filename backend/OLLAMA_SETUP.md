# Ollama Integration Setup

The backend now supports Ollama as an alternative to Google Gemini for AI-powered features.

## Configuration

### Environment Variables

Add these to your `.env` file:

#### For Ollama Cloud (Recommended)
```env
# Ollama Cloud Configuration
OLLAMA_API_KEY=your_ollama_cloud_api_key   # Required for Ollama Cloud
# OLLAMA_BASE_URL is auto-set to https://ollama.com when API key is provided
OLLAMA_MODEL=llama3.2                      # Default: llama3.2
USE_OLLAMA=true                            # Set to true to use Ollama instead of Gemini
```

#### For Local Ollama Instance
```env
# Local Ollama Configuration
OLLAMA_BASE_URL=http://localhost:11434     # Local Ollama server
OLLAMA_MODEL=llama3.2                      # Default: llama3.2
USE_OLLAMA=true                            # Set to true to use Ollama instead of Gemini
# OLLAMA_API_KEY not needed for local instances
```

### How It Works

- If `OLLAMA_API_KEY` is set OR `USE_OLLAMA=true`, the backend will use Ollama
- **Ollama Cloud**: If `OLLAMA_API_KEY` is set, automatically uses `https://ollama.com` as base URL
- **Local Ollama**: If `OLLAMA_BASE_URL` is set to local address, uses local instance
- Otherwise, it falls back to Gemini (if `GEMINI_API_KEY` is set)
- The service automatically detects which AI provider to use based on environment variables

## Ollama Setup

### Option 1: Ollama Cloud (Recommended)

1. **Get Your API Key**
   - Sign in to [ollama.com](https://ollama.com)
   - Navigate to account settings
   - Create a new API key
   - Copy the API key

2. **Configure Backend**

   Set these in your `.env` file:
   ```env
   OLLAMA_API_KEY=your_ollama_cloud_api_key
   OLLAMA_MODEL=llama3.2
   USE_OLLAMA=true
   ```
   
   The backend will automatically use `https://ollama.com` as the base URL when `OLLAMA_API_KEY` is set.

### Option 2: Local Ollama Instance

1. **Install Ollama**

   Visit [https://ollama.ai](https://ollama.ai) and install Ollama for your platform.

2. **Pull a Model**

   ```bash
   ollama pull llama3.2
   ```

   Or use any other model:
   ```bash
   ollama pull mistral
   ollama pull codellama
   ollama pull llama2
   ```

3. **Start Ollama Server**

   Ollama runs a local server by default on `http://localhost:11434`. Make sure it's running:

   ```bash
   ollama serve
   ```

4. **Configure Backend**

   Set the environment variables in your `.env` file:

   ```env
   OLLAMA_BASE_URL=http://localhost:11434
   OLLAMA_MODEL=llama3.2
   USE_OLLAMA=true
   ```
   (No API key needed for local instances)

## Features Supported

All AI features work with Ollama:

- ✅ Document summarization
- ✅ Question answering (Q&A)
- ✅ Search and answer
- ✅ Chat conversations

## Testing

After setting up, test the integration:

1. Start the backend: `python run.py`
2. Check logs for: "Using Ollama service with model: llama3.2"
3. Try generating a document summary via the API
4. Test search and Q&A endpoints

## Troubleshooting

### Ollama Connection Error

**For Ollama Cloud:**
- Verify `OLLAMA_API_KEY` is set correctly
- Check that the API key is valid and has proper permissions
- Ensure you have internet connectivity

**For Local Ollama:**
- Ensure Ollama server is running: `ollama serve`
- Check `OLLAMA_BASE_URL` matches your Ollama instance (default: `http://localhost:11434`)
- For local instances, `OLLAMA_API_KEY` is optional

### Model Not Found

- Pull the model: `ollama pull llama3.2`
- Verify model name in `OLLAMA_MODEL` matches available models
- List available models: `ollama list`

### Slow Responses

- Ollama can be slower than cloud APIs
- Consider using smaller/faster models
- Increase timeout in `ollama_service.py` if needed
- Use GPU-accelerated Ollama for better performance

## Switching Between Ollama and Gemini

To switch back to Gemini:

```env
USE_OLLAMA=false
GEMINI_API_KEY=your_gemini_key
```

Or simply remove `OLLAMA_API_KEY` and `USE_OLLAMA` from your `.env` file.

