FROM gitpod/workspace-full

RUN sudo apt-get update  \
    && apt-get install fuse \
    && curl -LO https://github.com/neovim/neovim/releases/latest/download/nvim.appimage \
    && chmod u+x nvim.appimage \
    && ./nvim.appimage \
    && sudo apt-get install -y  tmux  && sudo rm -rf /var/lib/apt/lists/* \
    && git clone https://github.com/gpakosz/.tmux.git && ln -s -f .tmux/.tmux.conf && cp .tmux/.tmux.conf.local .