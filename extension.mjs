// Extension: markdown-viewer
// A beautiful markdown viewer with mermaid diagram rendering and optimized layout for readability

import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { joinSession, createCanvas } from "@github/copilot-sdk/extension";

const servers = new Map(); // instanceId → { server, url, content, title }

function escapeHtml(str) {
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function renderViewerHtml(content, title) {
    const escapedContent = JSON.stringify(content || "");
    const escapedTitle = escapeHtml(title || "Markdown Viewer");

    return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>${escapedTitle}</title>
<script src="https://cdn.jsdelivr.net/npm/marked@15/marked.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js"></script>
<style>
* { box-sizing: border-box; margin: 0; padding: 0; }

body {
    background: var(--background-color-default, #0d1117);
    color: var(--text-color-default, #e6edf3);
    font-family: var(--font-sans, -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif);
    font-size: var(--text-body-medium, 14px);
    line-height: var(--leading-body-medium, 1.6);
    padding: 0;
    overflow-x: hidden;
}

.viewer-container {
    max-width: 860px;
    margin: 0 auto;
    padding: 40px 32px;
}

/* Typography */
h1, h2, h3, h4, h5, h6 {
    font-family: var(--font-sans-display, var(--font-sans, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif));
    font-weight: var(--font-weight-semibold, 600);
    color: var(--text-color-default, #e6edf3);
    margin-top: 1.5em;
    margin-bottom: 0.5em;
    line-height: 1.3;
}

h1 {
    font-size: var(--text-title-large, 28px);
    line-height: var(--leading-title-large, 1.25);
    padding-bottom: 0.3em;
    border-bottom: 1px solid var(--border-color-default, #30363d);
    margin-top: 0;
}

h2 {
    font-size: 22px;
    padding-bottom: 0.25em;
    border-bottom: 1px solid var(--border-color-default, #30363d);
}

h3 { font-size: 18px; }
h4 { font-size: 16px; }
h5 { font-size: 14px; }
h6 { font-size: 13px; color: var(--text-color-muted, #8b949e); }

p {
    margin-bottom: 1em;
    line-height: 1.7;
}

/* Links */
a {
    color: var(--true-color-blue, #58a6ff);
    text-decoration: none;
}
a:hover { text-decoration: underline; }

/* Lists */
ul, ol {
    padding-left: 2em;
    margin-bottom: 1em;
}
li { margin-bottom: 0.35em; line-height: 1.6; }
li > ul, li > ol { margin-top: 0.35em; margin-bottom: 0; }

/* Code */
code {
    font-family: var(--font-mono, "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace);
    font-size: 0.9em;
    background: rgba(110, 118, 129, 0.15);
    border-radius: 5px;
    padding: 0.15em 0.4em;
}

pre {
    background: rgba(110, 118, 129, 0.1);
    border: 1px solid var(--border-color-default, #30363d);
    border-radius: 8px;
    padding: 16px 20px;
    overflow-x: auto;
    margin-bottom: 1.25em;
    line-height: 1.5;
}

pre code {
    background: transparent;
    padding: 0;
    border-radius: 0;
    font-size: 13px;
}

/* Blockquotes */
blockquote {
    border-left: 4px solid var(--true-color-blue, #58a6ff);
    padding: 0.5em 1em;
    margin: 0 0 1.25em 0;
    color: var(--text-color-muted, #8b949e);
    background: rgba(110, 118, 129, 0.05);
    border-radius: 0 6px 6px 0;
}
blockquote p:last-child { margin-bottom: 0; }

/* Tables */
table {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 1.25em;
    font-size: 13px;
}
th, td {
    border: 1px solid var(--border-color-default, #30363d);
    padding: 8px 12px;
    text-align: left;
}
th {
    background: rgba(110, 118, 129, 0.1);
    font-weight: var(--font-weight-semibold, 600);
}
tr:nth-child(even) { background: rgba(110, 118, 129, 0.04); }

/* Horizontal rule */
hr {
    border: 0;
    height: 1px;
    background: var(--border-color-default, #30363d);
    margin: 2em 0;
}

/* Images */
img {
    max-width: 100%;
    height: auto;
    border-radius: 8px;
    margin: 0.5em 0;
}

/* Task lists */
input[type="checkbox"] {
    margin-right: 0.5em;
    pointer-events: none;
}

/* Mermaid diagrams - optimized display */
.mermaid-container {
    margin: 1.5em 0;
    padding: 24px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid var(--border-color-default, #30363d);
    border-radius: 12px;
    overflow-x: auto;
    display: flex;
    justify-content: center;
    align-items: center;
    min-height: 100px;
}

.mermaid-container svg {
    max-width: 100%;
    height: auto;
}

/* Mermaid node text readability */
.mermaid-container .nodeLabel,
.mermaid-container .edgeLabel,
.mermaid-container .label {
    font-family: var(--font-sans, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif) !important;
    font-size: 13px !important;
}

/* Loading state */
.mermaid-loading {
    color: var(--text-color-muted, #8b949e);
    font-style: italic;
    text-align: center;
    padding: 20px;
}

/* Empty state */
.empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 60vh;
    color: var(--text-color-muted, #8b949e);
    text-align: center;
}
.empty-state svg {
    width: 64px;
    height: 64px;
    margin-bottom: 16px;
    opacity: 0.4;
}
.empty-state h2 {
    border: none;
    color: var(--text-color-muted, #8b949e);
    font-size: 20px;
}
.empty-state p {
    max-width: 400px;
    line-height: 1.5;
}

/* Smooth scroll and transitions */
html { scroll-behavior: smooth; }

/* Scrollbar styling */
::-webkit-scrollbar { width: 8px; height: 8px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb {
    background: rgba(110, 118, 129, 0.3);
    border-radius: 4px;
}
::-webkit-scrollbar-thumb:hover { background: rgba(110, 118, 129, 0.5); }
</style>
</head>
<body>
<div class="viewer-container" id="content"></div>
<script>
(async () => {
    const rawContent = ${escapedContent};
    const container = document.getElementById("content");

    if (!rawContent || rawContent.trim() === "") {
        container.innerHTML = \`
            <div class="empty-state">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                    <path d="M14 2v6h6"/>
                    <path d="M16 13H8M16 17H8M10 9H8"/>
                </svg>
                <h2>Markdown Viewer</h2>
                <p>Use the <code>update_content</code> action to render markdown content with beautiful mermaid diagram support.</p>
            </div>\`;
        return;
    }

    // Configure marked
    marked.setOptions({
        gfm: true,
        breaks: false,
    });

    // Custom renderer to intercept mermaid code blocks
    const renderer = new marked.Renderer();
    let mermaidCount = 0;

    renderer.code = function({ text, lang }) {
        if (lang === "mermaid") {
            const id = "mermaid-" + (mermaidCount++);
            return '<div class="mermaid-container"><pre class="mermaid" id="' + id + '">' + text + '</pre></div>';
        }
        return '<pre><code class="language-' + (lang || "") + '">' + escapeForHtml(text) + '</code></pre>';
    };

    function escapeForHtml(str) {
        return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    }

    marked.use({ renderer });

    // Render markdown
    container.innerHTML = marked.parse(rawContent);

    // Initialize mermaid with optimized settings
    const isDark = document.documentElement.getAttribute("data-color-mode") === "dark" ||
        window.matchMedia("(prefers-color-scheme: dark)").matches;

    mermaid.initialize({
        startOnLoad: false,
        theme: isDark ? "dark" : "default",
        themeVariables: isDark ? {
            primaryColor: "#388bfd",
            primaryTextColor: "#e6edf3",
            primaryBorderColor: "#388bfd",
            lineColor: "#8b949e",
            secondaryColor: "#1f2937",
            tertiaryColor: "#161b22",
            background: "#0d1117",
            mainBkg: "#161b22",
            nodeBorder: "#30363d",
            clusterBkg: "#161b22",
            clusterBorder: "#30363d",
            titleColor: "#e6edf3",
            edgeLabelBackground: "#0d1117",
            nodeTextColor: "#e6edf3",
        } : {
            primaryColor: "#0969da",
            primaryTextColor: "#1f2328",
            primaryBorderColor: "#0969da",
            lineColor: "#656d76",
            secondaryColor: "#ddf4ff",
            tertiaryColor: "#f6f8fa",
        },
        flowchart: {
            htmlLabels: true,
            curve: "basis",
            padding: 12,
            nodeSpacing: 50,
            rankSpacing: 60,
            diagramPadding: 16,
            useMaxWidth: true,
        },
        sequence: {
            diagramMarginX: 20,
            diagramMarginY: 20,
            actorMargin: 80,
            width: 180,
            height: 50,
            boxMargin: 10,
            boxTextMargin: 8,
            noteMargin: 10,
            messageMargin: 40,
            useMaxWidth: true,
        },
        gantt: {
            titleTopMargin: 25,
            barHeight: 24,
            barGap: 6,
            topPadding: 50,
            leftPadding: 100,
            useMaxWidth: true,
        },
        pie: { useMaxWidth: true },
        er: { useMaxWidth: true },
        gitGraph: { useMaxWidth: true },
    });

    // Render all mermaid diagrams
    try {
        await mermaid.run({ querySelector: ".mermaid" });
    } catch (e) {
        // If mermaid fails, show the raw diagram code gracefully
        document.querySelectorAll(".mermaid[data-processed]").forEach(el => {
            if (!el.querySelector("svg")) {
                el.innerHTML = "<pre><code>" + escapeForHtml(el.textContent) + "</code></pre>";
            }
        });
    }
})();
</script>
</body>
</html>`;
}

async function startServer(instanceId) {
    const entry = { server: null, url: "", content: "", title: "Markdown Viewer" };

    const server = createServer((req, res) => {
        if (req.method === "GET" && (req.url === "/" || req.url === "")) {
            res.setHeader("Content-Type", "text/html; charset=utf-8");
            res.end(renderViewerHtml(entry.content, entry.title));
        } else if (req.method === "GET" && req.url === "/content") {
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ content: entry.content, title: entry.title }));
        } else {
            res.statusCode = 404;
            res.end("Not found");
        }
    });

    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    const port = typeof address === "object" && address ? address.port : 0;
    entry.server = server;
    entry.url = `http://127.0.0.1:${port}/`;
    return entry;
}

const session = await joinSession({
    canvases: [
        createCanvas({
            id: "markdown-viewer",
            displayName: "Markdown Viewer",
            description: "A beautiful read-only markdown viewer with mermaid diagram rendering. Pass markdown content to render it with optimized typography and diagram layout.",
            inputSchema: {
                type: "object",
                properties: {
                    content: {
                        type: "string",
                        description: "The markdown content to render, including any mermaid code blocks",
                    },
                    title: {
                        type: "string",
                        description: "Optional title for the viewer panel",
                    },
                },
            },
            actions: [
                {
                    name: "update_content",
                    description: "Update the displayed markdown content. Use this to render new or modified markdown with mermaid diagrams.",
                    inputSchema: {
                        type: "object",
                        properties: {
                            content: {
                                type: "string",
                                description: "The markdown content to render",
                            },
                            title: {
                                type: "string",
                                description: "Optional title for the viewer panel",
                            },
                        },
                        required: ["content"],
                    },
                    handler: async (ctx) => {
                        const entry = servers.get(ctx.instanceId);
                        if (!entry) {
                            return { error: "No viewer instance found" };
                        }
                        if (ctx.input?.content !== undefined) {
                            entry.content = ctx.input.content;
                        }
                        if (ctx.input?.title) {
                            entry.title = ctx.input.title;
                        }
                        return { success: true, message: "Content updated. Reload the viewer to see changes." };
                    },
                },
                {
                    name: "load_file",
                    description: "Load and render a markdown file from the filesystem",
                    inputSchema: {
                        type: "object",
                        properties: {
                            path: {
                                type: "string",
                                description: "Absolute path to the markdown file to render",
                            },
                        },
                        required: ["path"],
                    },
                    handler: async (ctx) => {
                        const entry = servers.get(ctx.instanceId);
                        if (!entry) {
                            return { error: "No viewer instance found" };
                        }
                        try {
                            const fileContent = await readFile(ctx.input.path, "utf-8");
                            entry.content = fileContent;
                            const fileName = ctx.input.path.split("/").pop();
                            entry.title = fileName || "Markdown Viewer";
                            return { success: true, message: `Loaded ${fileName}. Reload the viewer to see changes.` };
                        } catch (err) {
                            return { error: `Failed to read file: ${err.message}` };
                        }
                    },
                },
            ],
            open: async (ctx) => {
                let entry = servers.get(ctx.instanceId);
                if (!entry) {
                    entry = await startServer(ctx.instanceId);
                    servers.set(ctx.instanceId, entry);
                }
                // Set initial content from input if provided
                if (ctx.input?.content) {
                    entry.content = ctx.input.content;
                }
                if (ctx.input?.title) {
                    entry.title = ctx.input.title;
                }
                return {
                    title: entry.title || "Markdown Viewer",
                    url: entry.url,
                };
            },
            onClose: async (ctx) => {
                const entry = servers.get(ctx.instanceId);
                if (entry) {
                    servers.delete(ctx.instanceId);
                    if (entry.server) {
                        await new Promise((resolve) => entry.server.close(() => resolve()));
                    }
                }
            },
        }),
    ],
});
