const { execSync } = require('child_process')
const { cpSync, mkdirSync, rmSync, writeFileSync, existsSync, createWriteStream } = require('fs')
const { resolve, join } = require('path')
const { createRequire } = require('module')
const pkg = require('../package.json')

const PROJECT_DIR = resolve(__dirname, '..')
const name = (pkg.name + '_v' + pkg.version).replace(/[-.]/g, '_')
const DIST_DIR = join(PROJECT_DIR, name)
const ARCHIVE = join(PROJECT_DIR, `${name}.tar.gz`)

console.log(`==> 打包 ${name}...`)

// 清理旧产物
if (existsSync(DIST_DIR)) rmSync(DIST_DIR, { recursive: true })
if (existsSync(ARCHIVE)) rmSync(ARCHIVE)
mkdirSync(DIST_DIR, { recursive: true })

// 1. 构建
console.log('==> 正在构建项目...')
execSync('npm run build', { cwd: PROJECT_DIR, stdio: 'inherit' })

// 2. 拷贝文件
console.log('==> 拷贝部署文件...')
cpSync(join(PROJECT_DIR, '.output'), join(DIST_DIR, '.output'), { recursive: true })
cpSync(join(PROJECT_DIR, 'package.json'), join(DIST_DIR, 'package.json'))
if (existsSync(join(PROJECT_DIR, 'Dockerfile'))) {
  cpSync(join(PROJECT_DIR, 'Dockerfile'), join(DIST_DIR, 'Dockerfile'))
}

// 创建空 data 目录
mkdirSync(join(DIST_DIR, 'data'), { recursive: true })

// 3. 启动脚本
writeFileSync(join(DIST_DIR, 'start.sh'), `#!/bin/bash
export NODE_ENV=production
export HOST=0.0.0.0
export PORT=4530
cd "$(dirname "$0")"
node .output/server/index.mjs
`)

// 4. PM2 配置
writeFileSync(join(DIST_DIR, 'ecosystem.config.cjs'), `module.exports = {
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
`)

// 5. 压缩为 tar.gz
console.log('==> 正在压缩...')
execSync('tar -czf "../' + name + '.tar.gz" .', { cwd: DIST_DIR, stdio: 'inherit' })

// 6. 清理
rmSync(DIST_DIR, { recursive: true })

console.log(`==> 打包完成: ${name}.tar.gz`)
console.log('')
console.log('部署步骤:')
console.log(`  1. 上传 ${name}.tar.gz 到服务器`)
console.log(`  2. mkdir -p /www/wwwroot/${name} && cd /www/wwwroot/${name}`)
console.log(`  3. tar -xzf ${name}.tar.gz --strip-components=1`)
console.log('  4. pm2 start ecosystem.config.cjs')
console.log('  5. 访问 http://你的IP:4530 完成初始化')
