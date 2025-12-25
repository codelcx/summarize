## Install
```bash
# 1. 根目录安装所有工作区共享依赖
pnpm add -w <package-name>

# 2. 为特定子项目安装依赖
pnpm add <package-name> --filter <project-name>

# 3. 安装所有子项目的依赖
pnpm install

# 示例
pnpm add -w typescript jest  # 根目录安装
pnpm add react --filter web-app  # 为 web-app 安装 react
pnpm add lodash --filter api-server  # 为 api-server 安装 lodash