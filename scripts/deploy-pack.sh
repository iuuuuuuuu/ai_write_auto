#!/bin/bash
# 打包部署文件到 dist.tar.gz
# 排除：模型文件、数据库文件、备份文件

set -e

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
DIST_DIR="$PROJECT_DIR/dist"
ARCHIVE="$PROJECT_DIR/dist.tar.gz"

echo "==> 开始打包部署文件..."

# 清理旧产物
rm -rf "$DIST_DIR" "$ARCHIVE"
mkdir -p "$DIST_DIR"

# 1. 构建项目
echo "==> 正在构建项目..."
cd "$PROJECT_DIR"
npm run build

# 2. 拷贝必要文件
echo "==> 拷贝部署文件..."
cp -r .output "$DIST_DIR/"
cp package.json "$DIST_DIR/"
cp Dockerfile "$DIST_DIR/" 2>/dev/null || true

# 创建空 data 目录（运行时 setup 流程会写入）
mkdir -p "$DIST_DIR/data"

# 3. 拷贝启动脚本
cat > "$DIST_DIR/start.sh" << 'EOF'
#!/bin/bash
export NODE_ENV=production
export HOST=0.0.0.0
export PORT=4530
cd "$(dirname "$0")"
node .output/server/index.mjs
EOF
chmod +x "$DIST_DIR/start.sh"

# 4. 拷贝 PM2 配置
cat > "$DIST_DIR/ecosystem.config.cjs" << 'EOF'
module.exports = {
  apps: [{
    name: 'ai-novel',
    script: '.output/server/index.mjs',
    cwd: __dirname,
    env: {
      NODE_ENV: 'production',
      HOST: '0.0.0.0',
      PORT: 4530,
    },
    instances: 1,
    autorestart: true,
    max_memory_restart: '512M',
  }]
}
EOF

# 5. 打包为 tar.gz
echo "==> 正在压缩..."
cd "$PROJECT_DIR"
tar -czf "$ARCHIVE" -C "$DIST_DIR" .

# 6. 清理临时目录
rm -rf "$DIST_DIR"

SIZE=$(du -h "$ARCHIVE" | cut -f1)
echo "==> 打包完成: dist.tar.gz ($SIZE)"
echo ""
echo "部署步骤:"
echo "  1. 上传 dist.tar.gz 到服务器"
echo "  2. mkdir -p /www/wwwroot/ai-novel && cd /www/wwwroot/ai-novel"
echo "  3. tar -xzf dist.tar.gz"
echo "  4. pm2 start ecosystem.config.cjs"
echo "  5. 访问 http://你的IP:4530 完成初始化"
