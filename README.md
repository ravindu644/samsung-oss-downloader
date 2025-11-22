## How to install

**Requirements:** Chromium-based browser (Brave, Chrome, etc), Linux environment with `curl` installed.

> Tested with: `Brave 1.83.120 (Official Build) (64-bit)`

1. Download the extension ZIP from [Github releases](https://github.com/ravindu644/samsung-oss-downloader/releases) and extract it somewhere.
2. Go to your Chromium-based browser’s extensions page and enable developer options.
3. Select “Load Unpacked” and choose the path to the extracted ZIP to install the extension.
4. Go to https://opensource.samsung.com, search for anything, solve the CAPTCHA, and press the download button.
5. After you press the download button, the extension will automatically capture the details in Base64.
6. Run `dl.sh` to start the download: `./dl.sh <BASE64_VALUE>`
