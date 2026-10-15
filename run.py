"""
CyberHunt - Rapid Prototype Server Launcher
RYMEC Dept of ISE / INFOTSAV 2K26
"""

import uvicorn
import socket
import os

def get_local_ip():
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "127.0.0.1"

if __name__ == "__main__":
    local_ip = get_local_ip()
    port = 8000
    print("=" * 65)
    print("   CYBERHUNT 2026 // DIGITAL TREASURE HUNT PLATFORM")
    print("   RYMEC Dept of ISE - INFOTSAV 2K26 Hacksprint")
    print("=" * 65)
    print(f"[*] Local Access:    http://localhost:{port}")
    print(f"[*] Mobile/WiFi IP:  http://{local_ip}:{port}")
    print(f"[*] Organizer PIN:   admin123")
    print("=" * 65)
    print("Launching server. Press Ctrl+C to terminate...")
    uvicorn.run("backend.app:app", host="0.0.0.0", port=port, reload=False)
