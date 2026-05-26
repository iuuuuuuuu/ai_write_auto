import tailwindcss from '@tailwindcss/vite'

export default defineNuxtConfig({
  devServer: {
    port: 4530,
    host: 'localhost'
  },

  app: {
    pageTransition: { name: 'page', mode: 'out-in' },
    layoutTransition: { name: 'page', mode: 'out-in' },
    head: {
      link: [
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        {
          rel: 'preconnect',
          href: 'https://fonts.gstatic.com',
          crossorigin: ''
        },
        {
          rel: 'stylesheet',
          href: 'https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap'
        }
      ]
    }
  },

  css: ['~/assets/css/main.css'],

  build: {
    transpile: ['vue-echarts', 'echarts', 'zrender'],
  },

  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },

  modules: ['@bg-dev/nuxt-naiveui', '@nuxtjs/i18n'],

  vite: {
    plugins: [tailwindcss()],
    css: {
      devSourcemap: false,
    },
    build: {
      cssMinify: true,
    },
    optimizeDeps: {
      include: [
        '@iconify/vue',
        '@milkdown/core',
        '@milkdown/plugin-listener',
        '@milkdown/preset-commonmark',
        '@milkdown/theme-nord',
        '@milkdown/utils',
        '@vue/devtools-core',
        '@vue/devtools-kit',
        'echarts/core',
        'echarts/renderers',
        'echarts/charts',
        'echarts/components',
        'vue-echarts'
      ]
    }
  },

  i18n: {
    locales: [
      { code: 'zh-CN', name: '中文', file: 'zh-CN.json' },
      { code: 'en-US', name: 'English', file: 'en-US.json' }
    ],
    defaultLocale: 'zh-CN',
    langDir: '../i18n/locales'
  },

  runtimeConfig: {
    jwtSecret:
      process.env.JWT_SECRET || 'ai-novel-writer-secret-change-in-production',
    dbType: process.env.DB_TYPE || 'sqlite',
    dbSqlitePath: process.env.DB_SQLITE_PATH || './data/novel.db',
    dbMysqlHost: process.env.DB_MYSQL_HOST || 'localhost',
    dbMysqlPort: process.env.DB_MYSQL_PORT || '3306',
    dbMysqlUser: process.env.DB_MYSQL_USER || 'root',
    dbMysqlPassword: process.env.DB_MYSQL_PASSWORD || '',
    dbMysqlDatabase: process.env.DB_MYSQL_DATABASE || 'ai_novel',
    public: {
      siteName: 'AI Novel Writer',
      siteDescription: 'AI-powered novel writing platform'
    }
  },

  nitro: {
    experimental: {
      asyncContext: true
    },
    externals: {
      inline: [],
      external: ['libsql', '@libsql/linux-x64-gnu', '@libsql/linux-x64-musl', '@libsql/linux-arm64-gnu', '@libsql/linux-arm64-musl']
    }
  }
})
