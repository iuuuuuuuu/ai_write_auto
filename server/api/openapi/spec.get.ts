export default defineEventHandler(() => {
  const config = useRuntimeConfig()
  const baseUrl = config.public?.baseUrl || ''

  const spec = {
    openapi: '3.0.3',
    info: {
      title: 'AI Novel Writer API',
      version: '1.0.0',
      description: 'AI 小说写作平台的开放 API。使用方式：在请求头中传入 `Authorization: Bearer <API Token>`，API Token 可在设置页的 Open API 面板创建。SSE 接口返回 `data: {...}` 格式的流式片段。'
    },
    servers: [
      { url: baseUrl || '/', description: 'Current server' }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT or API Token'
        }
      },
      schemas: {
        Novel: {
          type: 'object',
          properties: {
            id: { type: 'integer', example: 1 },
            title: { type: 'string', example: '我的小说' },
            description: { type: 'string', example: '这是一个描述' },
            genre: { type: 'string', example: 'fantasy' },
            status: { type: 'string', enum: ['draft', 'in_progress', 'completed'], example: 'draft' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' }
          }
        },
        Chapter: {
          type: 'object',
          properties: {
            id: { type: 'integer', example: 1 },
            novelId: { type: 'integer', example: 1 },
            chapterNumber: { type: 'integer', example: 1 },
            title: { type: 'string', example: '第一章' },
            content: { type: 'string', example: '正文内容...' },
            summary: { type: 'string' },
            status: { type: 'string', enum: ['draft', 'generated', 'edited', 'final'] },
            wordCount: { type: 'integer', example: 3000 },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' }
          }
        },
        Character: {
          type: 'object',
          properties: {
            id: { type: 'integer', example: 1 },
            novelId: { type: 'integer', example: 1 },
            name: { type: 'string', example: '主角' },
            description: { type: 'string', example: '勇敢的少年' },
            traits: { type: 'string' },
            relationships: { type: 'string' },
            createdAt: { type: 'string', format: 'date-time' }
          }
        },
        AiGenerateRequest: {
          type: 'object',
          properties: {
            novelId: { type: 'integer', example: 1 },
            chapterId: { type: 'integer', example: 1 },
            direction: { type: 'string', example: '描写主角进入森林的场景' },
            aiConfigId: { type: 'integer' }
          },
          required: ['novelId']
        },
        AiActionRequest: {
          type: 'object',
          properties: {
            novelId: { type: 'integer', example: 1 },
            chapterId: { type: 'integer', example: 1 },
            selectedText: { type: 'string', example: '需要扩写的文本' },
            contextBefore: { type: 'string', example: '前文内容...' },
            aiConfigId: { type: 'integer' }
          },
          required: ['novelId', 'chapterId']
        },
        ApiToken: {
          type: 'object',
          properties: {
            id: { type: 'integer', example: 1 },
            name: { type: 'string', example: 'CI 部署脚本' },
            createdAt: { type: 'string', format: 'date-time' },
            lastUsedAt: { type: 'string', format: 'date-time', nullable: true }
          }
        },
        ApiTokenCreated: {
          type: 'object',
          properties: {
            id: { type: 'integer', example: 1 },
            name: { type: 'string', example: 'CI 部署脚本' },
            token: { type: 'string', example: 'ak_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx' },
            createdAt: { type: 'string', format: 'date-time' }
          }
        },
        SuccessResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true }
          }
        },
        ErrorResponse: {
          type: 'object',
          properties: {
            statusCode: { type: 'integer', example: 400 },
            statusMessage: { type: 'string', example: 'Bad Request' }
          }
        }
      }
    },
    security: [{ bearerAuth: [] }],
    paths: {
      '/api/novels': {
        get: {
          tags: ['Novels'],
          summary: '获取小说列表',
          responses: {
            '200': {
              description: '小说列表',
              content: {
                'application/json': {
                  schema: {
                    type: 'array',
                    items: { $ref: '#/components/schemas/Novel' }
                  }
                }
              }
            }
          }
        },
        post: {
          tags: ['Novels'],
          summary: '创建小说',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    title: { type: 'string', example: '新小说' },
                    description: { type: 'string' },
                    genre: { type: 'string', example: 'fantasy' }
                  },
                  required: ['title']
                }
              }
            }
          },
          responses: {
            '200': { description: '创建的小说', content: { 'application/json': { schema: { $ref: '#/components/schemas/Novel' } } } }
          }
        }
      },
      '/api/novels/{id}': {
        get: {
          tags: ['Novels'],
          summary: '获取小说详情',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
          responses: {
            '200': { description: '小说详情', content: { 'application/json': { schema: { $ref: '#/components/schemas/Novel' } } } }
          }
        },
        put: {
          tags: ['Novels'],
          summary: '更新小说',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    title: { type: 'string' },
                    description: { type: 'string' },
                    genre: { type: 'string' },
                    status: { type: 'string' }
                  }
                }
              }
            }
          },
          responses: { '200': { description: '更新成功' } }
        },
        delete: {
          tags: ['Novels'],
          summary: '删除小说（移入回收站）',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
          responses: { '200': { description: '删除成功' } }
        }
      },
      '/api/novels/{id}/chapters': {
        get: {
          tags: ['Chapters'],
          summary: '获取章节列表',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
          responses: {
            '200': {
              description: '章节列表',
              content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/Chapter' } } } }
            }
          }
        },
        post: {
          tags: ['Chapters'],
          summary: '创建章节',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    title: { type: 'string', example: '第一章' },
                    chapterNumber: { type: 'integer', example: 1 }
                  },
                  required: ['title']
                }
              }
            }
          },
          responses: { '200': { description: '创建的章节', content: { 'application/json': { schema: { $ref: '#/components/schemas/Chapter' } } } } }
        }
      },
      '/api/novels/{id}/chapters/{chapterId}': {
        get: {
          tags: ['Chapters'],
          summary: '获取章节详情',
          parameters: [
            { name: 'id', in: 'path', required: true, schema: { type: 'integer' } },
            { name: 'chapterId', in: 'path', required: true, schema: { type: 'integer' } }
          ],
          responses: {
            '200': { description: '章节详情', content: { 'application/json': { schema: { $ref: '#/components/schemas/Chapter' } } } }
          }
        },
        put: {
          tags: ['Chapters'],
          summary: '更新章节',
          parameters: [
            { name: 'id', in: 'path', required: true, schema: { type: 'integer' } },
            { name: 'chapterId', in: 'path', required: true, schema: { type: 'integer' } }
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    title: { type: 'string' },
                    content: { type: 'string' },
                    summary: { type: 'string' },
                    status: { type: 'string' }
                  }
                }
              }
            }
          },
          responses: { '200': { description: '更新成功' } }
        }
      },
      '/api/novels/{id}/characters': {
        get: {
          tags: ['Characters'],
          summary: '获取角色列表',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
          responses: {
            '200': {
              description: '角色列表',
              content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/Character' } } } }
            }
          }
        },
        post: {
          tags: ['Characters'],
          summary: '创建角色',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    name: { type: 'string', example: '主角' },
                    description: { type: 'string' },
                    traits: { type: 'string' }
                  },
                  required: ['name']
                }
              }
            }
          },
          responses: { '200': { description: '创建的角色', content: { 'application/json': { schema: { $ref: '#/components/schemas/Character' } } } } }
        }
      },
      '/api/ai/generate': {
        post: {
          tags: ['AI'],
          summary: 'AI 生成章节（SSE 流式）',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/AiGenerateRequest' }
              }
            }
          },
          responses: {
            '200': {
              description: 'SSE 流，格式：data: { "content": "...", "done": false }',
              content: { 'text/event-stream': { schema: { type: 'string' } } }
            }
          }
        }
      },
      '/api/ai/expand': {
        post: {
          tags: ['AI'],
          summary: 'AI 扩写选中文本（SSE 流式）',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/AiActionRequest' }
              }
            }
          },
          responses: {
            '200': {
              description: 'SSE 流',
              content: { 'text/event-stream': { schema: { type: 'string' } } }
            }
          }
        }
      },
      '/api/ai/rewrite': {
        post: {
          tags: ['AI'],
          summary: 'AI 改写选中文本（SSE 流式）',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/AiActionRequest' }
              }
            }
          },
          responses: {
            '200': {
              description: 'SSE 流',
              content: { 'text/event-stream': { schema: { type: 'string' } } }
            }
          }
        }
      },
      '/api/ai/continue': {
        post: {
          tags: ['AI'],
          summary: 'AI 续写光标处内容（SSE 流式）',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    novelId: { type: 'integer' },
                    chapterId: { type: 'integer' },
                    contextBefore: { type: 'string', description: '光标前的文本上下文' },
                    direction: { type: 'string' },
                    aiConfigId: { type: 'integer' }
                  },
                  required: ['novelId', 'chapterId']
                }
              }
            }
          },
          responses: {
            '200': {
              description: 'SSE 流',
              content: { 'text/event-stream': { schema: { type: 'string' } } }
            }
          }
        }
      },
      '/api/openapi/tokens': {
        get: {
          tags: ['Open API'],
          summary: '获取当前用户 API Token 列表',
          description: '仅返回 Token 元信息，不返回 tokenHash 或原始 Token。',
          responses: {
            '200': {
              description: 'API Token 列表',
              content: {
                'application/json': {
                  schema: {
                    type: 'array',
                    items: { $ref: '#/components/schemas/ApiToken' }
                  },
                  example: [
                    {
                      id: 1,
                      name: 'CI 部署脚本',
                      createdAt: '2026-05-21T08:00:00.000Z',
                      lastUsedAt: null
                    }
                  ]
                }
              }
            }
          }
        },
        post: {
          tags: ['Open API'],
          summary: '创建 API Token',
          description: '原始 Token 只会在创建时返回一次，请立即复制保存。',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    name: { type: 'string', minLength: 1, maxLength: 100, example: 'CI 部署脚本' }
                  },
                  required: ['name']
                },
                example: { name: 'CI 部署脚本' }
              }
            }
          },
          responses: {
            '200': {
              description: '创建成功，仅本次返回原始 Token',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/ApiTokenCreated' }
                }
              }
            }
          }
        }
      },
      '/api/openapi/tokens/{id}': {
        delete: {
          tags: ['Open API'],
          summary: '删除 API Token',
          parameters: [
            { name: 'id', in: 'path', required: true, schema: { type: 'integer' } }
          ],
          responses: {
            '200': {
              description: '删除成功',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/SuccessResponse' }
                }
              }
            }
          }
        }
      },
      '/api/search': {
        get: {
          tags: ['Search'],
          summary: '全文搜索',
          parameters: [
            { name: 'q', in: 'query', required: true, schema: { type: 'string' }, description: '搜索关键词' }
          ],
          responses: {
            '200': { description: '搜索结果' }
          }
        }
      }
    }
  }

  return spec
})
