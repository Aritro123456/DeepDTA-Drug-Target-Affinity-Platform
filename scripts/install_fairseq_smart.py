import requests
import os
import subprocess
import sys

def install_fairseq():
    # GitHub API to list releases
    api_url = "https://api.github.com/repos/BlueAmulet/fairseq-win-whl/releases"
    
    print(f"Querying {api_url}...")
    try:
        response = requests.get(api_url)
        response.raise_for_status()
        releases = response.json()
    except Exception as e:
        print(f"Failed to fetch releases: {e}")
        return

    # Target wheel name substring
    target_str = "cp312-cp312-win_amd64.whl"
    
    download_url = None
    asset_name = None

    print(f"Searching for asset containing '{target_str}'...")
    
    for release in releases:
        for asset in release.get('assets', []):
            if target_str in asset['name']:
                download_url = asset['browser_download_url']
                asset_name = asset['name']
                print(f"Found match: {asset_name}")
                print(f"Download URL: {download_url}")
                break
        if download_url:
            break
    
    if not download_url:
        print("No matching wheel found.")
        return

    # Download
    print(f"Downloading {asset_name}...")
    try:
        r = requests.get(download_url, stream=True)
        r.raise_for_status()
        with open(asset_name, "wb") as f:
            for chunk in r.iter_content(chunk_size=8192):
                f.write(chunk)
        print(f"Successfully downloaded {asset_name}")
        
        # Install
        print(f"Installing {asset_name}...")
        subprocess.check_call([sys.executable, "-m", "pip", "install", asset_name])
        print("Installation successful!")
        
    except Exception as e:
        print(f"Failed to download/install: {e}")

if __name__ == "__main__":
    install_fairseq()
