#!/usr/bin/env python3
"""
StreamBox Video Extractor Backend
Uses yt-dlp to extract direct video URLs from vidsrc.to, vidsrc.icu, vidlink.pro
"""

import os
import json
import asyncio
import subprocess
import re
from datetime import datetime, timedelta
from typing import Dict, List, Optional
import aiohttp
from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse, FileResponse
import uvicorn
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="StreamBox Video Extractor", version="1.0")

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, replace with your domain
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configuration
CACHE_DURATION = 3600  # 1 hour cache
MAX_RETRIES = 3
YT_DLP_TIMEOUT = 30

# Cache storage
video_cache = {}

class VideoExtractor:
    def __init__(self):
        self.supported_sites = [
            "vidsrc.to",
            "vidsrc.icu",
            "vidlink.pro",
            "vidplay.online",
            "multiembed.mov",
            "2embed.cc"
        ]
        
    async def extract_with_yt_dlp(self, url: str) -> Optional[Dict]:
        """
        Use yt-dlp to extract video information
        Returns: {
            'url': direct_video_url,
            'title': video_title,
            'ext': file_extension,
            'quality': quality,
            'duration': duration_seconds,
            'thumbnail': thumbnail_url,
            'formats': [list of available formats]
        }
        """
        try:
            # Prepare yt-dlp command
            cmd = [
                'yt-dlp',
                '--no-warnings',
                '--no-check-certificate',
                '--quiet',
                '--skip-download',
                '--dump-json',
                '--no-playlist',
                '--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                '--referer', 'https://vidsrc.to/',
                url
            ]
            
            logger.info(f"Running yt-dlp for: {url}")
            
            # Run yt-dlp with timeout
            process = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            
            try:
                stdout, stderr = await asyncio.wait_for(
                    process.communicate(),
                    timeout=YT_DLP_TIMEOUT
                )
            except asyncio.TimeoutError:
                process.kill()
                await process.wait()
                logger.error(f"yt-dlp timeout for: {url}")
                return None
            
            if process.returncode != 0:
                error_msg = stderr.decode('utf-8', errors='ignore')
                logger.error(f"yt-dlp failed: {error_msg}")
                return None
            
            # Parse JSON output
            output = stdout.decode('utf-8', errors='ignore')
            try:
                data = json.loads(output)
            except json.JSONDecodeError:
                logger.error("Failed to parse yt-dlp JSON output")
                return None
            
            # Extract best format (highest quality)
            if 'formats' in data and data['formats']:
                # Sort formats by quality (higher first)
                formats = sorted(
                    data['formats'],
                    key=lambda x: (
                        x.get('height', 0),
                        x.get('width', 0),
                        x.get('tbr', 0)
                    ),
                    reverse=True
                )
                
                best_format = formats[0]
                
                result = {
                    'url': best_format.get('url', ''),
                    'title': data.get('title', 'Video'),
                    'ext': best_format.get('ext', 'mp4'),
                    'quality': f"{best_format.get('height', 'Unknown')}p",
                    'duration': data.get('duration', 0),
                    'thumbnail': data.get('thumbnail', ''),
                    'formats': [
                        {
                            'url': f.get('url'),
                            'quality': f"{f.get('height', 'Unknown')}p",
                            'ext': f.get('ext', 'mp4'),
                            'size': f.get('filesize', 0)
                        }
                        for f in formats[:5]  # Top 5 formats
                    ]
                }
                
                logger.info(f"Extracted video: {result['quality']} - {result['url'][:50]}...")
                return result
            else:
                # Try direct URL
                if 'url' in data:
                    return {
                        'url': data['url'],
                        'title': data.get('title', 'Video'),
                        'ext': data.get('ext', 'mp4'),
                        'quality': 'Unknown',
                        'duration': data.get('duration', 0),
                        'thumbnail': data.get('thumbnail', ''),
                        'formats': []
                    }
                
        except Exception as e:
            logger.error(f"Error in yt-dlp extraction: {e}")
        
        return None
    
    async def extract_from_vidsrc(self, movie_id: str, is_tv: bool = False) -> Optional[Dict]:
        """
        Extract video from vidsrc.to or vidsrc.icu
        """
        base_urls = [
            f"https://vidsrc.to/embed/movie/{movie_id}",
            f"https://vidsrc.icu/embed/movie/{movie_id}",
            f"https://vidsrc.to/v/{movie_id}",
            f"https://vidsrc.icu/v/{movie_id}"
        ]
        
        if is_tv:
            base_urls = [
                f"https://vidsrc.to/embed/tv/{movie_id}",
                f"https://vidsrc.icu/embed/tv/{movie_id}"
            ]
        
        for url in base_urls:
            logger.info(f"Trying vidsrc URL: {url}")
            result = await self.extract_with_yt_dlp(url)
            if result and result['url']:
                return result
        
        return None
    
    async def extract_from_vidlink(self, movie_id: str) -> Optional[Dict]:
        """
        Extract video from vidlink.pro
        """
        urls = [
            f"https://vidlink.pro/movie/{movie_id}",
            f"https://vidlink.pro/tv/{movie_id}",
            f"https://vidlink.pro/embed/{movie_id}"
        ]
        
        for url in urls:
            logger.info(f"Trying vidlink URL: {url}")
            result = await self.extract_with_yt_dlp(url)
            if result and result['url']:
                return result
        
        return None
    
    async def extract_multi_sources(self, movie_id: str, is_tv: bool = False) -> Dict:
        """
        Try multiple sources and return the best result
        """
        results = []
        
        # Try vidsrc sources first
        vidsrc_result = await self.extract_from_vidsrc(movie_id, is_tv)
        if vidsrc_result:
            vidsrc_result['source'] = 'vidsrc'
            results.append(vidsrc_result)
        
        # Try vidlink
        vidlink_result = await self.extract_from_vidlink(movie_id)
        if vidlink_result:
            vidlink_result['source'] = 'vidlink'
            results.append(vidlink_result)
        
        # Try other common sources
        other_urls = [
            f"https://multiembed.mov/?video_id={movie_id}&tmdb=1",
            f"https://2embed.cc/embed/{movie_id}"
        ]
        
        for url in other_urls:
            result = await self.extract_with_yt_dlp(url)
            if result:
                result['source'] = 'multiembed'
                results.append(result)
                break
        
        # Return the best result (highest quality)
        if results:
            # Sort by quality (extract number from '480p', '720p', etc.)
            def quality_score(r):
                match = re.search(r'(\d+)p', r.get('quality', '0p'))
                return int(match.group(1)) if match else 0
            
            results.sort(key=quality_score, reverse=True)
            return results[0]
        
        return None

# Initialize extractor
extractor = VideoExtractor()

@app.get("/")
async def root():
    return {
        "status": "online",
        "service": "StreamBox Video Extractor",
        "version": "1.0.0",
        "timestamp": datetime.now().isoformat()
    }

@app.get("/health")
async def health():
    return {"status": "healthy"}

@app.get("/api/extract/{movie_id}")
async def extract_video(
    movie_id: str,
    is_tv: bool = Query(False, description="Is this a TV show?"),
    source: str = Query("auto", description="Preferred source: vidsrc, vidlink, auto"),
    quality: str = Query("best", description="Preferred quality: best, 1080p, 720p, 480p, 360p")
):
    """
    Extract direct video URL for a movie/TV show
    """
    # Check cache first
    cache_key = f"{movie_id}_{is_tv}_{source}_{quality}"
    if cache_key in video_cache:
        cached_time, cached_data = video_cache[cache_key]
        if datetime.now() - cached_time < timedelta(seconds=CACHE_DURATION):
            logger.info(f"Returning cached result for {movie_id}")
            return JSONResponse({
                **cached_data,
                "cached": True
            })
    
    logger.info(f"Extracting video for ID: {movie_id}, TV: {is_tv}")
    
    try:
        # Extract based on preferred source
        result = None
        
        if source == "vidsrc":
            result = await extractor.extract_from_vidsrc(movie_id, is_tv)
        elif source == "vidlink":
            result = await extractor.extract_from_vidlink(movie_id)
        else:  # auto - try all sources
            result = await extractor.extract_multi_sources(movie_id, is_tv)
        
        if not result:
            raise HTTPException(status_code=404, detail="Video not found on any supported sources")
        
        # Filter quality if specified
        if quality != "best" and result.get('formats'):
            filtered_formats = [
                fmt for fmt in result['formats']
                if fmt.get('quality', '').startswith(quality)
            ]
            if filtered_formats:
                result['url'] = filtered_formats[0]['url']
                result['quality'] = filtered_formats[0]['quality']
        
        # Cache the result
        video_cache[cache_key] = (datetime.now(), result)
        
        return JSONResponse({
            **result,
            "movie_id": movie_id,
            "is_tv": is_tv,
            "extraction_time": datetime.now().isoformat(),
            "cached": False
        })
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Extraction error: {e}")
        raise HTTPException(status_code=500, detail=f"Extraction failed: {str(e)}")

@app.get("/api/stream/{movie_id}")
async def stream_video(
    movie_id: str,
    is_tv: bool = Query(False),
    source: str = Query("auto"),
    request: Request = None
):
    """
    Stream video directly (proxied through server)
    """
    # Get the video URL
    extract_result = await extract_video(movie_id, is_tv, source, "best")
    video_data = extract_result.body
    video_json = json.loads(video_data.decode())
    
    if not video_json.get('url'):
        raise HTTPException(status_code=404, detail="No video URL found")
    
    video_url = video_json['url']
    
    # Stream the video with proper headers
    try:
        async with aiohttp.ClientSession() as session:
            headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Range': request.headers.get('Range', ''),
                'Referer': 'https://vidsrc.to/'
            }
            
            async with session.get(video_url, headers=headers) as response:
                # Forward appropriate headers for streaming
                headers = {}
                if 'Content-Length' in response.headers:
                    headers['Content-Length'] = response.headers['Content-Length']
                if 'Content-Type' in response.headers:
                    headers['Content-Type'] = response.headers['Content-Type']
                if 'Accept-Ranges' in response.headers:
                    headers['Accept-Ranges'] = response.headers['Accept-Ranges']
                if 'Content-Range' in response.headers:
                    headers['Content-Range'] = response.headers['Content-Range']
                
                return StreamingResponse(
                    response.content.iter_chunked(8192),
                    headers=headers,
                    status_code=response.status
                )
                
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Streaming failed: {str(e)}")

@app.get("/api/providers")
async def list_providers():
    """
    List all supported video providers
    """
    return {
        "providers": extractor.supported_sites,
        "count": len(extractor.supported_sites)
    }

@app.get("/api/player/{movie_id}")
async def get_player_html(movie_id: str, is_tv: bool = False):
    """
    Return HTML page with embedded video player
    """
    # Get video URL
    extract_result = await extract_video(movie_id, is_tv, "auto", "best")
    video_data = extract_result.body
    video_json = json.loads(video_data.decode())
    
    if not video_json.get('url'):
        raise HTTPException(status_code=404, detail="No video URL found")
    
    video_url = video_json['url']
    
    # Generate HTML player
    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>StreamBox - Now Playing</title>
        <style>
            body {{
                margin: 0;
                padding: 0;
                background: #000;
                display: flex;
                justify-content: center;
                align-items: center;
                min-height: 100vh;
                font-family: Arial, sans-serif;
            }}
            .player-container {{
                width: 100%;
                max-width: 1200px;
                background: #111;
                border-radius: 10px;
                overflow: hidden;
                box-shadow: 0 0 20px rgba(0,0,0,0.5);
            }}
            video {{
                width: 100%;
                height: auto;
                display: block;
            }}
            .controls {{
                padding: 15px;
                background: #222;
                color: white;
                display: flex;
                justify-content: space-between;
                align-items: center;
            }}
            .back-button {{
                background: #e50914;
                color: white;
                border: none;
                padding: 10px 20px;
                border-radius: 5px;
                cursor: pointer;
                font-size: 14px;
            }}
            .video-info {{
                font-size: 14px;
                color: #ccc;
            }}
            .quality-badge {{
                background: #e50914;
                color: white;
                padding: 2px 8px;
                border-radius: 3px;
                font-size: 12px;
                margin-left: 10px;
            }}
        </style>
    </head>
    <body>
        <div class="player-container">
            <video controls autoplay playsinline>
                <source src="{video_url}" type="video/mp4">
                Your browser does not support the video tag.
            </video>
            <div class="controls">
                <button class="back-button" onclick="window.history.back()">← Back</button>
                <div class="video-info">
                    Now Playing • <span class="quality-badge">{video_json.get('quality', 'HD')}</span>
                </div>
            </div>
        </div>
        
        <script>
            // Auto-fullscreen on mobile
            if (/Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) {{
                const video = document.querySelector('video');
                video.addEventListener('click', () => {{
                    if (video.requestFullscreen) {{
                        video.requestFullscreen();
                    }} else if (video.webkitRequestFullscreen) {{
                        video.webkitRequestFullscreen();
                    }} else if (video.msRequestFullscreen) {{
                        video.msRequestFullscreen();
                    }}
                }});
            }}
            
            // Save playback position
            const video = document.querySelector('video');
            const movieId = '{movie_id}';
            
            // Load saved position
            const savedTime = localStorage.getItem(`streambox_time_${{movieId}}`);
            if (savedTime) {{
                video.currentTime = parseFloat(savedTime);
            }}
            
            // Save position every 5 seconds
            setInterval(() => {{
                localStorage.setItem(`streambox_time_${{movieId}}`, video.currentTime);
            }}, 5000);
            
            // Mark as watched when video ends
            video.addEventListener('ended', () => {{
                localStorage.removeItem(`streambox_time_${{movieId}}`);
                // You can add additional logic here (mark as watched in your app)
            }});
        </script>
    </body>
    </html>
    """
    
    return HTMLResponse(html_content)

# Custom response class
class HTMLResponse:
    def __init__(self, content: str, status_code: int = 200):
        self.content = content
        self.status_code = status_code
    
    def __call__(self, scope, receive, send):
        from starlette.responses import Response
        response = Response(
            content=self.content,
            status_code=self.status_code,
            media_type="text/html"
        )
        return response(scope, receive, send)

# Startup event
@app.on_event("startup")
async def startup_event():
    logger.info("Starting StreamBox Video Extractor...")
    # Check if yt-dlp is installed
    try:
        result = subprocess.run(['yt-dlp', '--version'], 
                               capture_output=True, text=True)
        if result.returncode == 0:
            logger.info(f"yt-dlp version: {result.stdout.strip()}")
        else:
            logger.warning("yt-dlp not found. Installing...")
            subprocess.run(['pip', 'install', 'yt-dlp', '--quiet'])
    except:
        logger.warning("Failed to check yt-dlp. Will attempt to install on first use.")

if __name__ == "__main__":
    port = int(os.getenv("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)