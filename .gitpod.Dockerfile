FROM gitpod/workspace-full

ENV NODE_VERSION=14

RUN sudo apt-get update \
        && sudo apt-get install -y \
        && sudo rm -rf /var/lib/apt/lists/*

# Install Node
RUN bash -c "source $HOME/.nvm/nvm.sh && nvm install ${NODE_VERSION} && nvm use ${NODE_VERSION} && nvm alias default ${NODE_VERSION}"
RUN echo "nvm use default &>/dev/null" >> ~/.bashrc.d/51-nvm-fix
RUN npm install -g yarn && npm install -g gulp
