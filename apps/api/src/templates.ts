/**
 * Agentic OS - Project Templates
 * 
 * Pre-built starter templates for common project types
 */

export interface TemplateFile {
  path: string;
  content: string;
  description?: string;
}

export interface ProjectTemplate {
  id: string;
  name: string;
  description: string;
  category: 'frontend' | 'backend' | 'fullstack' | 'data' | 'ai';
  tags: string[];
  files: TemplateFile[];
  dependencies?: string[];
  devDependencies?: string[];
  scripts?: Record<string, string>;
  setupCommands?: string[];
  estimatedTime: string; // e.g., "5 min"
  complexity: 'simple' | 'medium' | 'advanced';
}

// ============================================
// Template Definitions
// ============================================

export const templates: Record<string, ProjectTemplate> = {
  
  // ============== FRONTEND ==============
  
  'react-app': {
    id: 'react-app',
    name: 'React App',
    description: 'Vite + React + TypeScript with modern tooling',
    category: 'frontend',
    tags: ['react', 'vite', 'typescript', 'css'],
    files: [
      {
        path: 'package.json',
        content: JSON.stringify({
          name: 'my-react-app',
          private: true,
          version: '0.0.1',
          type: 'module',
          scripts: {
            dev: 'vite',
            build: 'tsc && vite build',
            preview: 'vite preview',
            lint: 'eslint . --ext ts,tsx --report-unused-disable-directives --max-warnings 0'
          },
          dependencies: {
            react: '^18.2.0',
            'react-dom': '^18.2.0'
          },
          devDependencies: {
            '@types/react': '^18.2.43',
            '@types/react-dom': '^18.2.17',
            '@typescript-eslint/eslint-plugin': '^6.14.0',
            '@typescript-eslint/parser': '^6.14.0',
            '@vitejs/plugin-react': '^4.2.1',
            eslint: '^8.55.0',
            'eslint-plugin-react-hooks': '^4.6.0',
            typescript: '^5.2.2',
            vite: '^5.0.8'
          }
        }, null, 2),
        description: 'Package configuration'
      },
      {
        path: 'vite.config.ts',
        content: `import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    open: true
  }
})`,
        description: 'Vite configuration'
      },
      {
        path: 'tsconfig.json',
        content: JSON.stringify({
          compilerOptions: {
            target: 'ES2020',
            useDefineForClassFields: true,
            lib: ['ES2020', 'DOM', 'DOM.Iterable'],
            module: 'ESNext',
            skipLibCheck: true,
            moduleResolution: 'bundler',
            allowImportingTsExtensions: true,
            resolveJsonModule: true,
            isolatedModules: true,
            noEmit: true,
            jsx: 'react-jsx',
            strict: true,
            noUnusedLocals: true,
            noUnusedParameters: true,
            noFallthroughCasesInSwitch: true
          },
          include: ['src'],
          references: [{ path: './tsconfig.node.json' }]
        }, null, 2),
        description: 'TypeScript configuration'
      },
      {
        path: 'index.html',
        content: `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>My React App</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>`,
        description: 'HTML entry point'
      },
      {
        path: 'src/main.tsx',
        content: `import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)`,
        description: 'Application entry point'
      },
      {
        path: 'src/App.tsx',
        content: `import { useState } from 'react'
import './App.css'

function App() {
  const [count, setCount] = useState(0)

  return (
    <>
      <h1>Vite + React</h1>
      <div className="card">
        <button onClick={() => setCount((count) => count + 1)}>
          count is {count}
        </button>
        <p>
          Edit <code>src/App.tsx</code> and save to test HMR
        </p>
      </div>
    </>
  )
}

export default App`,
        description: 'Main App component'
      },
      {
        path: 'src/index.css',
        content: `:root {
  font-family: Inter, system-ui, Avenir, Helvetica, Arial, sans-serif;
  line-height: 1.5;
  font-weight: 400;
  color-scheme: light dark;
}

body {
  margin: 0;
  display: flex;
  place-items: center;
  min-width: 320px;
  min-height: 100vh;
}`,
        description: 'Global styles'
      },
      {
        path: 'src/App.css',
        content: `.card {
  padding: 2em;
  text-align: center;
}`,
        description: 'App styles'
      }
    ],
    scripts: {
      install: 'npm install',
      dev: 'npm run dev',
      build: 'npm run build'
    },
    setupCommands: [
      'npm install'
    ],
    estimatedTime: '10 min',
    complexity: 'simple'
  },

  // ============== BACKEND ==============
  
  'node-api': {
    id: 'node-api',
    name: 'Node.js API',
    description: 'Express + TypeScript REST API server',
    category: 'backend',
    tags: ['express', 'node', 'typescript', 'api'],
    files: [
      {
        path: 'package.json',
        content: JSON.stringify({
          name: 'my-api',
          version: '1.0.0',
          type: 'module',
          main: 'dist/index.js',
          scripts: {
            build: 'tsc',
            start: 'node dist/index.js',
            dev: 'tsx watch src/index.ts',
            lint: 'eslint src --ext .ts'
          },
          dependencies: {
            express: '^4.18.2',
            cors: '^2.8.5',
            helmet: '^7.1.0',
            'dotenv': '^16.3.1'
          },
          devDependencies: {
            '@types/express': '^4.17.21',
            '@types/cors': '^2.8.17',
            typescript: '^5.3.3',
            tsx: '^4.7.0',
            '@typescript-eslint/eslint-plugin': '^6.19.0',
            '@typescript-eslint/parser': '^6.19.0',
            eslint: '^8.56.0'
          }
        }, null, 2)
      },
      {
        path: 'tsconfig.json',
        content: JSON.stringify({
          compilerOptions: {
            target: 'ES2022',
            module: 'NodeNext',
            moduleResolution: 'NodeNext',
            outDir: './dist',
            rootDir: './src',
            strict: true,
            esModuleInterop: true,
            skipLibCheck: true,
            forceConsistentCasingInFileNames: true,
            resolveJsonModule: true
          },
          include: ['src/**/*'],
          exclude: ['node_modules']
        }, null, 2)
      },
      {
        path: 'src/index.ts',
        content: `import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes
app.get('/api', (req, res) => {
  res.json({ 
    message: 'Welcome to the API',
    version: '1.0.0',
    endpoints: ['/api/users', '/api/posts']
  });
});

// Example routes
app.get('/api/users', (req, res) => {
  res.json([
    { id: 1, name: 'John Doe', email: 'john@example.com' },
    { id: 2, name: 'Jane Smith', email: 'jane@example.com' }
  ]);
});

app.get('/api/posts', (req, res) => {
  res.json([
    { id: 1, title: 'First Post', author: 'John' },
    { id: 2, title: 'Second Post', author: 'Jane' }
  ]);
});

// Error handling
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

app.listen(PORT, () => {
  console.log(\`Server running on port \${PORT}\`);
});

export default app;`,
        description: 'Main Express application'
      },
      {
        path: '.env.example',
        content: `PORT=3000
NODE_ENV=development
DATABASE_URL=postgresql://user:pass@localhost:5432/mydb
REDIS_URL=redis://localhost:6379`,
        description: 'Environment variables'
      }
    ],
    scripts: {
      install: 'npm install',
      dev: 'npm run dev',
      build: 'npm run build',
      start: 'npm start'
    },
    setupCommands: [
      'npm install',
      'cp .env.example .env'
    ],
    estimatedTime: '10 min',
    complexity: 'simple'
  },

  // ============== FULLSTACK ==============
  
  'fullstack-next': {
    id: 'fullstack-next',
    name: 'Next.js Fullstack',
    description: 'Next.js 14 App Router + Prisma + Tailwind',
    category: 'fullstack',
    tags: ['nextjs', 'prisma', 'tailwind', 'typescript', 'fullstack'],
    files: [
      {
        path: 'package.json',
        content: JSON.stringify({
          name: 'my-fullstack-app',
          version: '0.1.0',
          private: true,
          scripts: {
            dev: 'next dev',
            build: 'next build',
            start: 'next start',
            lint: 'next lint',
            'db:generate': 'prisma generate',
            'db:push': 'prisma db push',
            'db:studio': 'prisma studio'
          },
          dependencies: {
            next: '14.1.0',
            react: '^18.2.0',
            'react-dom': '^18.2.0',
            '@prisma/client': '^5.9.0'
          },
          devDependencies: {
            'prisma': '^5.9.0',
            typescript: '^5.3.3',
            '@types/node': '^20.11.5',
            '@types/react': '^18.2.48',
            '@types/react-dom': '^18.2.18',
            autoprefixer: '^10.4.17',
            postcss: '^8.4.33',
            tailwindcss: '^3.4.1',
            eslint: '^8.56.0',
            'eslint-config-next': '14.1.0'
          }
        }, null, 2)
      },
      {
        path: 'prisma/schema.prisma',
        content: `generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id        DateTime @id @default(now())
  email     String   @unique
  name      String?
  createdAt DateTime @default(now())
  posts     Post[]
}

model Post {
  id        DateTime  @id @default(now())
  title     String
  content   String?
  published Boolean   @default(false)
  authorId  Int
  author    User      @relation(fields: [authorId], references: [id])
}`,
        description: 'Prisma schema'
      },
      {
        path: 'next.config.js',
        content: `/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: true,
  },
};

module.exports = nextConfig;`,
        description: 'Next.js configuration'
      },
      {
        path: 'tailwind.config.js',
        content: `/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};`,
        description: 'Tailwind configuration'
      },
      {
        path: 'src/app/page.tsx',
        content: `import prisma from './lib/prisma';

async function getPosts() {
  return await prisma.post.findMany({
    where: { published: true },
    include: { author: true },
  });
}

export default async function Home() {
  const posts = await getPosts();

  return (
    <main className="max-w-4xl mx-auto p-8">
      <h1 className="text-4xl font-bold mb-8">Welcome to My App</h1>
      <div className="space-y-4">
        {posts.map((post) => (
          <article key={post.id} className="border rounded p-4">
            <h2 className="text-2xl font-semibold">{post.title}</h2>
            <p className="text-gray-600">By {post.author.name}</p>
          </article>
        ))}
      </div>
    </main>
  );
}`,
        description: 'Home page'
      },
      {
        path: 'src/app/layout.tsx',
        content: `import './globals.css';

export const metadata = {
  title: 'My Fullstack App',
  description: 'Generated by Agentic OS',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-gray-50">{children}</body>
    </html>
  );
}`,
        description: 'Root layout'
      },
      {
        path: 'src/app/globals.css',
        content: `@tailwind base;
@tailwind components;
@tailwind utilities;`,
        description: 'Global styles'
      },
      {
        path: 'src/lib/prisma.ts',
        content: `import { PrismaClient } from '@prisma/client';

const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma = globalForPrisma.prisma || new PrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;`,
        description: 'Prisma client singleton'
      }
    ],
    scripts: {
      install: 'npm install',
      dev: 'npm run dev',
      build: 'npm run build',
      db: 'npx prisma studio'
    },
    setupCommands: [
      'npm install',
      'npx prisma generate',
      'npx prisma db push'
    ],
    estimatedTime: '15 min',
    complexity: 'medium'
  },

  // ============== DATA ==============
  
  'python-flask': {
    id: 'python-flask',
    name: 'Python Flask API',
    description: 'Flask REST API with SQLAlchemy',
    category: 'data',
    tags: ['python', 'flask', 'api', 'sqlalchemy'],
    files: [
      {
        path: 'requirements.txt',
        content: `flask>=3.0.0
flask-cors>=4.0.0
flask-sqlalchemy>=3.1.0
python-dotenv>=1.0.0
psycopg2-binary>=2.9.9
gunicorn>=21.2.0`,
        description: 'Python dependencies'
      },
      {
        path: 'app.py',
        content: `from flask import Flask, jsonify, request
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from dotenv import load_dotenv
import os

load_dotenv()

app = Flask(__name__)
CORS(app)

# Database configuration
app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv(
    'DATABASE_URL', 
    'postgresql://postgres:postgres@localhost:5432/app'
)
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)

# Models
class User(db.Model):
    __tablename__ = 'users'
    
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(120), unique=True, nullable=False)
    name = db.Column(db.String(100), nullable=False)
    
    def to_dict(self):
        return {
            'id': self.id,
            'email': self.email,
            'name': self.name
        }

# Routes
@app.route('/health', methods=['GET'])
def health():
    return jsonify({'status': 'ok', 'timestamp': str(db.func.now())})

@app.route('/api/users', methods=['GET'])
def get_users():
    users = User.query.all()
    return jsonify([user.to_dict() for user in users])

@app.route('/api/users', methods=['POST'])
def create_user():
    data = request.get_json()
    user = User(email=data['email'], name=data['name'])
    db.session.add(user)
    db.session.commit()
    return jsonify(user.to_dict()), 201

@app.route('/api/users/<int:user_id>', methods=['GET'])
def get_user(user_id):
    user = User.query.get_or_404(user_id)
    return jsonify(user.to_dict())

if __name__ == '__main__':
    with app.app_context():
        db.create_all()
    app.run(debug=True, port=5000)`,
        description: 'Main Flask application'
      },
      {
        path: '.env.example',
        content: `FLASK_APP=app.py
FLASK_ENV=development
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/app`,
        description: 'Environment variables'
      }
    ],
    scripts: {
      install: 'pip install -r requirements.txt',
      dev: 'python app.py',
      prod: 'gunicorn app:app'
    },
    setupCommands: [
      'pip install -r requirements.txt',
      'flask db upgrade'
    ],
    estimatedTime: '10 min',
    complexity: 'simple'
  },

  // ============== AI ==============
  
  'ai-chatbot': {
    id: 'ai-chatbot',
    name: 'AI Chatbot',
    description: 'Claude/GPT powered chatbot with conversation history',
    category: 'ai',
    tags: ['ai', 'chatbot', 'openai', 'anthropic', 'llm'],
    files: [
      {
        path: 'package.json',
        content: JSON.stringify({
          name: 'ai-chatbot',
          version: '1.0.0',
          type: 'module',
          scripts: {
            dev: 'vite',
            build: 'tsc && vite build',
            preview: 'vite preview'
          },
          dependencies: {
            react: '^18.2.0',
            'react-dom': '^18.2.0',
            '@anthropic-ai/sdk': '^0.17.0',
            'openai': '^4.25.0'
          },
          devDependencies: {
            '@types/react': '^18.2.48',
            '@types/react-dom': '^18.2.18',
            '@vitejs/plugin-react': '^4.2.1',
            typescript: '^5.3.3',
            vite: '^5.0.12'
          }
        }, null, 2)
      },
      {
        path: 'vite.config.ts',
        content: `import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      }
    }
  }
})`,
        description: 'Vite configuration with API proxy'
      },
      {
        path: 'server/index.js',
        content: `import express from 'express';
import cors from 'cors';
import { Anthropic } from '@anthropic-ai/sdk';

const app = express();
const PORT = process.env.PORT || 3001;

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

app.use(cors());
app.use(express.json());

// In-memory conversation storage
const conversations = new Map();

app.post('/api/chat', async (req, res) => {
  const { message, conversationId = 'default' } = req.body;
  
  // Get or create conversation
  if (!conversations.has(conversationId)) {
    conversations.set(conversationId, []);
  }
  
  const history = conversations.get(conversationId);
  history.push({ role: 'user', content: message });
  
  try {
    const response = await anthropic.messages.create({
      model: 'claude-3-sonnet-20240229',
      max_tokens: 1024,
      messages: history,
    });
    
    const assistantMessage = response.content[0].text;
    history.push({ role: 'assistant', content: assistantMessage });
    
    res.json({
      response: assistantMessage,
      conversationId,
      usage: response.usage,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/conversations/:id', (req, res) => {
  const conversation = conversations.get(req.params.id) || [];
  res.json(conversation);
});

app.listen(PORT, () => {
  console.log(\`Chatbot server running on port \${PORT}\`);
});`,
        description: 'Backend API server'
      },
      {
        path: 'src/App.tsx',
        content: `import { useState } from 'react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const sendMessage = async () => {
    if (!input.trim()) return;
    
    const userMessage = input;
    setInput('');
    setLoading(true);
    
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMessage }),
      });
      
      const data = await res.json();
      
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: data.response 
      }]);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-8">
      <h1 className="text-3xl font-bold mb-6">AI Chatbot</h1>
      
      <div className="space-y-4 mb-4">
        {messages.map((msg, i) => (
          <div 
            key={i} 
            className={\`p-4 rounded \${msg.role === 'user' ? 'bg-blue-100 ml-8' : 'bg-gray-100 mr-8'}\`}
          >
            <strong>{msg.role === 'user' ? 'You' : 'Assistant'}:</strong>
            <p>{msg.content}</p>
          </div>
        ))}
        {loading && <p className="text-gray-500">Thinking...</p>}
      </div>
      
      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
          className="flex-1 p-3 border rounded"
          placeholder="Ask me anything..."
        />
        <button 
          onClick={sendMessage}
          disabled={loading}
          className="px-6 py-3 bg-blue-600 text-white rounded disabled:opacity-50"
        >
          Send
        </button>
      </div>
    </div>
  );
}

export default App;`,
        description: 'Chat interface'
      }
    ],
    scripts: {
      install: 'npm install',
      server: 'node server/index.js',
      client: 'npm run dev'
    },
    setupCommands: [
      'npm install',
      'cp .env.example .env'
    ],
    estimatedTime: '15 min',
    complexity: 'medium'
  }
};

// ============================================
// Helper Functions
// ============================================

export function getTemplate(id: string): ProjectTemplate | undefined {
  return templates[id];
}

export function getTemplatesByCategory(category: string): ProjectTemplate[] {
  return Object.values(templates).filter(t => t.category === category);
}

export function searchTemplates(query: string): ProjectTemplate[] {
  const q = query.toLowerCase();
  return Object.values(templates).filter(t => 
    t.name.toLowerCase().includes(q) ||
    t.description.toLowerCase().includes(q) ||
    t.tags.some(tag => tag.includes(q))
  );
}

export function getAllTemplates(): ProjectTemplate[] {
  return Object.values(templates);
}

export function createProjectFromTemplate(
  templateId: string,
  projectName: string
): { files: TemplateFile[], packageJson?: any } {
  const template = templates[templateId];
  if (!template) {
    throw new Error(`Template not found: ${templateId}`);
  }

  // Process files and replace placeholders
  const files = template.files.map(file => ({
    ...file,
    path: file.path.replace('my-', projectName.toLowerCase().replace(/\s+/g, '-') + '-'),
    content: file.content
      .replace(/my-/g, projectName.toLowerCase().replace(/\s+/g, '-'))
      .replace(/My/g, projectName.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '))
  }));

  // Parse package.json if exists
  const packageJsonFile = files.find(f => f.path === 'package.json');
  const packageJson = packageJsonFile ? JSON.parse(packageJsonFile.content) : undefined;

  return { files, packageJson };
}