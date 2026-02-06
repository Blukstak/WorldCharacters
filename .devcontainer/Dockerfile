FROM node:20-slim

RUN apt-get update && apt-get install -y \
    git \
    curl \
    sudo \
    lsof \
    build-essential \
    pkg-config \
    libwebkit2gtk-4.1-dev \
    libssl-dev \
    libayatana-appindicator3-dev \
    librsvg2-dev \
    libgtk-3-dev \
    libjavascriptcoregtk-4.1-dev \
    libsoup-3.0-dev \
    # Browser testing: headless + headed via noVNC
    xvfb \
    x11vnc \
    novnc \
    websockify \
    chromium \
    && rm -rf /var/lib/apt/lists/*

RUN usermod -l vscode -d /home/vscode -m node && \
    groupmod -n vscode node && \
    echo "vscode ALL=(ALL) NOPASSWD:ALL" >> /etc/sudoers

USER vscode

# Install Rust for vscode user
RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
ENV PATH="/home/vscode/.cargo/bin:${PATH}"

WORKDIR /WorldCharacters

CMD ["sleep", "infinity"]
