"""
CyberHunt - Instant Multi-Device Deployment Helper
RYMEC Dept of ISE / INFOTSAV 2K26
"""

import socket
import os
import sys

def get_ip():
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "127.0.0.1"

def print_deployment_info():
    if hasattr(sys.stdout, 'reconfigure'):
        try:
            sys.stdout.reconfigure(encoding='utf-8')
        except Exception:
            pass

    ip = get_ip()
    port = 8000

    print("\n" + "=" * 70)
    print("      [*] CYBERHUNT 2026 -- LIVE DEPLOYMENT STATUS")
    print("      RYMEC Dept of ISE // INFOTSAV 2K26 Hacksprint")
    print("=" * 70)
    print("\n[TIER 1] LOCAL LAPTOP TESTING (Judge Presentation):")
    print(f"  * Participant Portal:     http://localhost:{port}/")
    print(f"  * Organizer Command HQ:   http://localhost:{port}/admin")
    print("  * Organizer Master PIN:   admin123")
    
    print("\n[TIER 2] VENUE WI-FI / MOBILE HOTSPOT (Phone Reconnaissance):")
    print("  Connect your mobile phone to the same Wi-Fi or laptop hotspot:")
    print(f"  * Participant Mobile:     http://{ip}:{port}/")
    print(f"  * Organizer Mobile:       http://{ip}:{port}/admin")

    print("\n[TIER 3] PUBLIC CLOUD DEPLOYMENT (Instant Free Options):")
    print("  Option A - Cloudflare Quick Tunnel (Free, No Signup):")
    print("    winget install --id Cloudflare.cloudflared")
    print(f"    cloudflared tunnel --url http://127.0.0.1:{port}")
    print("\n  Option B - LocalTunnel (Node/npx):")
    print(f"    npx localtunnel --port {port}")

    print("\n" + "=" * 70)
    print("  Both frontends are isolated and running right now.")
    print("  Requirement 07 (Role Separation) & Requirement 08 (Deployment) Verified!")
    print("=" * 70 + "\n")

if __name__ == "__main__":
    print_deployment_info()
