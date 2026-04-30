/**
 * Templates Routes
 * 
 * API endpoints for project templates
 */

import { Hono } from 'hono';
import { 
  getAllTemplates, 
  getTemplate, 
  getTemplatesByCategory,
  searchTemplates,
  createProjectFromTemplate,
  type ProjectTemplate 
} from '../templates.js';

const app = new Hono();

/**
 * Get all templates
 * GET /api/templates
 */
app.get('/', async (c) => {
  const templates = getAllTemplates();
  
  // Return summary without file contents
  const summary = templates.map(t => ({
    id: t.id,
    name: t.name,
    description: t.description,
    category: t.category,
    tags: t.tags,
    estimatedTime: t.estimatedTime,
    complexity: t.complexity,
  }));
  
  return c.json({ templates: summary });
});

/**
 * Search templates
 * GET /api/templates/search?q=query
 * NOTE: Must be defined before /:id to avoid route conflict
 */
app.get('/search', async (c) => {
  const query = c.req.query('q') || '';
  
  if (!query) {
    return c.json({ templates: [] });
  }
  
  const templates = searchTemplates(query);
  
  const summary = templates.map(t => ({
    id: t.id,
    name: t.name,
    description: t.description,
    category: t.category,
    tags: t.tags,
  }));
  
  return c.json({ query, templates: summary });
});

/**
 * Get categories
 * GET /api/templates/meta/categories
 * NOTE: Must be before /:id
 */
app.get('/meta/categories', async (c) => {
  const templates = getAllTemplates();
  const categories = [...new Set(templates.map(t => t.category))];
  
  return c.json({
    categories: categories.map(cat => ({
      id: cat,
      name: cat.charAt(0).toUpperCase() + cat.slice(1),
      count: templates.filter(t => t.category === cat).length,
    })),
  });
});

/**
 * Get templates by category
 * GET /api/templates/category/:category
 * NOTE: Must be before /:id
 */
app.get('/category/:category', async (c) => {
  const category = c.req.param('category') as ProjectTemplate['category'];
  const templates = getTemplatesByCategory(category);
  
  const summary = templates.map(t => ({
    id: t.id,
    name: t.name,
    description: t.description,
    estimatedTime: t.estimatedTime,
    complexity: t.complexity,
  }));
  
  return c.json({ templates: summary });
});

/**
 * Get template by ID
 * GET /api/templates/:id
 * NOTE: Defined last as it catches everything
 */
app.get('/:id', async (c) => {
  const id = c.req.param('id');
  const template = getTemplate(id);
  
  if (!template) {
    return c.json({ error: `Template not found: ${id}` }, 404);
  }
  
  return c.json({ template });
});

/**
 * Preview project structure from template
 * GET /api/templates/:id/preview
 */
app.get('/:id/preview', async (c) => {
  const id = c.req.param('id');
  const projectName = c.req.query('name') || 'my-project';
  
  try {
    const { files, packageJson } = createProjectFromTemplate(id, projectName);
    
    // Return file structure without full content
    const structure = files.map(f => ({
      path: f.path,
      description: f.description,
    }));
    
    return c.json({
      templateId: id,
      projectName,
      structure,
      packageJson,
      estimatedTime: getTemplate(id)?.estimatedTime,
    });
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : 'Unknown error' }, 400);
  }
});

/**
 * Create project files from template
 * POST /api/templates/:id/generate
 */
app.post('/:id/generate', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();
  const projectName = body.name || 'my-project';
  
  try {
    const { files, packageJson } = createProjectFromTemplate(id, projectName);
    
    return c.json({
      success: true,
      templateId: id,
      projectName,
      files: files.map(f => ({
        path: f.path,
        content: f.content,
        description: f.description,
      })),
      scripts: getTemplate(id)?.scripts,
      setupCommands: getTemplate(id)?.setupCommands,
    });
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : 'Unknown error' }, 400);
  }
});

export default app;