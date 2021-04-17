FROM gitpod/workspace-full

RUN  sudo add-apt-repository ppa:neovim-ppa/unstable \
    &&  sudo apt-get update  \
    && sudo apt-get install -y neovim \
    && sudo apt-get install -y  tmux  && sudo rm -rf /var/lib/apt/lists/* \
    && git clone https://github.com/gpakosz/.tmux.git && ln -s -f .tmux/.tmux.conf && cp .tmux/.tmux.conf.local .