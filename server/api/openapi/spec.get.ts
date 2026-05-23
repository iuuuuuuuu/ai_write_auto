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
            { name: 'q', in: 'query', required: true, schema: { type: 'string' }, description: '搜索关键词' },
            { name: 'novelId', in: 'query', schema: { type: 'integer' }, description: '限定搜索范围到指定小说' }
          ],
          responses: {
            '200': { description: '搜索结果（chapters, novels, characters）' }
          }
        }
      },
      '/api/ai/regenerate': {
        post: {
          tags: ['AI'],
          summary: '基于反馈重新生成（SSE 流式）',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    novelId: { type: 'integer' },
                    chapterId: { type: 'integer' },
                    previousResult: { type: 'string', description: '上次生成的内容' },
                    feedback: { type: 'string', description: '用户反馈', example: '节奏太快，多加对话' },
                    aiConfigId: { type: 'integer' },
                    temperature: { type: 'number' },
                    maxTokens: { type: 'integer' }
                  },
                  required: ['novelId', 'previousResult', 'feedback']
                }
              }
            }
          },
          responses: {
            '200': { description: 'SSE 流', content: { 'text/event-stream': { schema: { type: 'string' } } } }
          }
        }
      },
      '/api/ai/fragment': {
        post: {
          tags: ['AI'],
          summary: 'AI 片段生成（对话/描写/动作/独白）（SSE 流式）',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    novelId: { type: 'integer' },
                    chapterId: { type: 'integer' },
                    fragmentType: { type: 'string', enum: ['dialogue', 'description', 'action', 'monologue'] },
                    contextBefore: { type: 'string' },
                    aiConfigId: { type: 'integer' }
                  },
                  required: ['novelId', 'chapterId', 'fragmentType']
                }
              }
            }
          },
          responses: {
            '200': { description: 'SSE 流', content: { 'text/event-stream': { schema: { type: 'string' } } } }
          }
        }
      },
      '/api/ai/batch-generate': {
        post: {
          tags: ['AI'],
          summary: '批量生成多章节',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    novelId: { type: 'integer' },
                    startChapter: { type: 'integer' },
                    endChapter: { type: 'integer' },
                    aiConfigId: { type: 'integer' }
                  },
                  required: ['novelId', 'startChapter', 'endChapter']
                }
              }
            }
          },
          responses: {
            '200': { description: '批量任务已创建' }
          }
        }
      },
      '/api/ai/consistency-check': {
        post: {
          tags: ['AI'],
          summary: '手动触发一致性检查',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    novelId: { type: 'integer' },
                    chapterId: { type: 'integer' }
                  },
                  required: ['novelId', 'chapterId']
                }
              }
            }
          },
          responses: {
            '200': { description: '检查结果', content: { 'application/json': { schema: { type: 'object', properties: { issues: { type: 'array', items: { type: 'object', properties: { type: { type: 'string' }, severity: { type: 'string' }, description: { type: 'string' } } } } } } } } }
          }
        }
      },
      '/api/ai/analyze-style': {
        post: {
          tags: ['AI'],
          summary: 'AI 分析写作风格',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    novelId: { type: 'integer' }
                  },
                  required: ['novelId']
                }
              }
            }
          },
          responses: {
            '200': { description: '风格分析结果' }
          }
        }
      },
      '/api/ai/suggest': {
        post: {
          tags: ['AI'],
          summary: 'AI 审阅章节并返回修改建议',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    novelId: { type: 'integer' },
                    chapterId: { type: 'integer' },
                    aiConfigId: { type: 'integer' }
                  },
                  required: ['novelId', 'chapterId']
                }
              }
            }
          },
          responses: {
            '200': {
              description: '建议列表',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      suggestions: {
                        type: 'array',
                        items: {
                          type: 'object',
                          properties: {
                            originalText: { type: 'string' },
                            suggestedText: { type: 'string' },
                            reason: { type: 'string' }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      },
      '/api/novels/{id}/chapters/{chapterId}/versions': {
        get: {
          tags: ['Chapters'],
          summary: '获取章节版本历史',
          parameters: [
            { name: 'id', in: 'path', required: true, schema: { type: 'integer' } },
            { name: 'chapterId', in: 'path', required: true, schema: { type: 'integer' } }
          ],
          responses: {
            '200': { description: '版本列表' }
          }
        }
      },
      '/api/novels/{id}/chapters/{chapterId}/versions/{versionId}/rollback': {
        post: {
          tags: ['Chapters'],
          summary: '回滚到指定版本',
          parameters: [
            { name: 'id', in: 'path', required: true, schema: { type: 'integer' } },
            { name: 'chapterId', in: 'path', required: true, schema: { type: 'integer' } },
            { name: 'versionId', in: 'path', required: true, schema: { type: 'integer' } }
          ],
          responses: {
            '200': { description: '回滚成功' }
          }
        }
      },
      '/api/novels/{id}/chapters/{chapterId}/notes': {
        get: {
          tags: ['Chapters'],
          summary: '获取章节作者笔记',
          parameters: [
            { name: 'id', in: 'path', required: true, schema: { type: 'integer' } },
            { name: 'chapterId', in: 'path', required: true, schema: { type: 'integer' } }
          ],
          responses: { '200': { description: '笔记内容' } }
        },
        put: {
          tags: ['Chapters'],
          summary: '更新章节作者笔记',
          parameters: [
            { name: 'id', in: 'path', required: true, schema: { type: 'integer' } },
            { name: 'chapterId', in: 'path', required: true, schema: { type: 'integer' } }
          ],
          requestBody: {
            required: true,
            content: { 'application/json': { schema: { type: 'object', properties: { content: { type: 'string' } }, required: ['content'] } } }
          },
          responses: { '200': { description: '更新成功' } }
        }
      },
      '/api/novels/{id}/chapters/{chapterId}/consistency-issues': {
        get: {
          tags: ['AI'],
          summary: '获取章节一致性问题列表',
          parameters: [
            { name: 'id', in: 'path', required: true, schema: { type: 'integer' } },
            { name: 'chapterId', in: 'path', required: true, schema: { type: 'integer' } }
          ],
          responses: { '200': { description: '一致性问题列表' } }
        }
      },
      '/api/stats/token-usage': {
        get: {
          tags: ['Stats'],
          summary: '获取 Token 用量统计',
          parameters: [
            { name: 'days', in: 'query', schema: { type: 'integer', default: 30 }, description: '统计天数' }
          ],
          responses: { '200': { description: 'Token 用量数据' } }
        }
      },
      '/api/settings/cost-rates': {
        get: {
          tags: ['Settings'],
          summary: '获取模型单价配置',
          responses: { '200': { description: '单价列表' } }
        },
        put: {
          tags: ['Settings'],
          summary: '创建或更新模型单价',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    model: { type: 'string', example: 'gpt-4o' },
                    inputCostPer1k: { type: 'string', example: '0.005' },
                    outputCostPer1k: { type: 'string', example: '0.015' }
                  },
                  required: ['model', 'inputCostPer1k', 'outputCostPer1k']
                }
              }
            }
          },
          responses: { '200': { description: '保存成功' } }
        }
      },
      '/api/settings/backup': {
        get: {
          tags: ['Settings'],
          summary: '获取备份列表和配置',
          responses: { '200': { description: '备份信息' } }
        },
        post: {
          tags: ['Settings'],
          summary: '手动触发备份',
          responses: { '200': { description: '备份成功' } }
        }
      }
    }
  }

  return spec
})
