export default defineNuxtConfig({
  devServer: {
    port: 4530
  },

  app: {
    pageTransition: { name: 'page', mode: 'out-in' }
  },

  css: ['~/assets/css/main.css'],

  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },

  modules: ['@nuxt/ui', '@nuxtjs/i18n'],

  colorMode: {
    preference: 'system',
    fallback: 'dark'
  },

  fonts: {
    defaults: {
      weights: [400, 500, 600, 700]
    },
    providers: {
      google: false,
      googleicons: false
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
    }
  }
})
