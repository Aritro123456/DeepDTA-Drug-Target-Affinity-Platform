import requests
import os

base_urls = [
    "https://github.com/BlueAmulet/fairseq-win-whl/releases/download/v0.13.2/fairseq-0.13.2-cp312-cp312-win_amd64.whl",
    "https://github.com/BlueAmulet/fairseq-win-whl/releases/download/0.13.2/fairseq-0.13.2-cp312-cp312-win_amd64.whl",
    "https://github.com/BlueAmulet/fairseq-win-whl/releases/download/v0.12.2/fairseq-0.12.2-cp312-cp312-win_amd64.whl",
    "https://github.com/BlueAmulet/fairseq-win-whl/releases/download/0.12.2/fairseq-0.12.2-cp312-cp312-win_amd64.whl"
]

for url in base_urls:
    print(f"Trying to download from {url}...")
    filename = url.split('/')[-1]
    try:
        r = requests.get(url, allow_redirects=True, stream=True)
        if r.status_code == 200:
            with open(filename, "wb") as f:
                for chunk in r.iter_content(chunk_size=8192):
                    f.write(chunk)
            print(f"Successfully downloaded {filename}")
            print(f"File size: {os.path.getsize(filename)} bytes")
            # Install it
            import subprocess
            print(f"Installing {filename}...")
            subprocess.check_call([".\\.venv\\Scripts\\python.exe", "-m", "pip", "install", filename])
            print("Installation successful!")
            break
        else:
            print(f"Failed: {r.status_code}")
    except Exception as e:
        print(f"Error: {e}")
