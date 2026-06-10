// Extension: markdown-viewer
// A beautiful markdown viewer with mermaid diagram rendering and optimized layout for readability

import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { joinSession, createCanvas } from "@github/copilot-sdk/extension";

const servers = new Map(); // instanceId → { server, url, content, title }

function escapeHtml(str) {
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function renderViewerHtml(content, title, version) {
    const escapedContent = JSON.stringify(content || "");
    const escapedTitle = escapeHtml(title || "Markdown Viewer");
    const initialVersion = version || 0;

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
    max-width: 100%;
    margin: 0 auto;
    padding: 24px 20px;
}

/* Typography */
h1, h2, h3, h4, h5, h6 {
    font-family: var(--font-sans-display, var(--font-sans, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif));
    font-weight: var(--font-weight-semibold, 600);
    color: var(--text-color-default, #e6edf3);
    margin-top: 1.25em;
    margin-bottom: 0.4em;
    line-height: 1.3;
}

h1 {
    font-size: clamp(22px, 4vw, 28px);
    line-height: var(--leading-title-large, 1.25);
    padding-bottom: 0.3em;
    border-bottom: 1px solid var(--border-color-default, #30363d);
    margin-top: 0;
}

h2 {
    font-size: clamp(18px, 3.5vw, 22px);
    padding-bottom: 0.25em;
    border-bottom: 1px solid var(--border-color-default, #30363d);
}

h3 { font-size: clamp(16px, 3vw, 18px); }
h4 { font-size: 15px; }
h5 { font-size: 14px; }
h6 { font-size: 13px; color: var(--text-color-muted, #8b949e); }

p {
    margin-bottom: 0.85em;
    line-height: 1.65;
}

/* Links */
a {
    color: var(--true-color-blue, #58a6ff);
    text-decoration: none;
}
a:hover { text-decoration: underline; }

/* Lists */
ul, ol {
    padding-left: 1.75em;
    margin-bottom: 0.85em;
}
li { margin-bottom: 0.3em; line-height: 1.6; }
li > ul, li > ol { margin-top: 0.3em; margin-bottom: 0; }

/* Code */
code {
    font-family: var(--font-mono, "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace);
    font-size: 0.88em;
    background: rgba(110, 118, 129, 0.15);
    border-radius: 4px;
    padding: 0.15em 0.4em;
    word-break: break-word;
}

pre {
    background: rgba(110, 118, 129, 0.1);
    border: 1px solid var(--border-color-default, #30363d);
    border-radius: 8px;
    padding: 14px 16px;
    overflow-x: auto;
    margin-bottom: 1.1em;
    line-height: 1.5;
}

pre code {
    background: transparent;
    padding: 0;
    border-radius: 0;
    font-size: 12.5px;
    word-break: normal;
}

/* Blockquotes */
blockquote {
    border-left: 3px solid var(--true-color-blue, #58a6ff);
    padding: 0.4em 0.85em;
    margin: 0 0 1.1em 0;
    color: var(--text-color-muted, #8b949e);
    background: rgba(110, 118, 129, 0.05);
    border-radius: 0 6px 6px 0;
}
blockquote p:last-child { margin-bottom: 0; }

/* Tables - responsive with horizontal scroll */
.table-wrapper {
    width: 100%;
    overflow-x: auto;
    margin-bottom: 1.1em;
    border-radius: 8px;
    border: 1px solid var(--border-color-default, #30363d);
    -webkit-overflow-scrolling: touch;
}

table {
    width: 100%;
    border-collapse: collapse;
    font-size: 12.5px;
    min-width: 400px;
}
th, td {
    border: 1px solid var(--border-color-default, #30363d);
    padding: 7px 10px;
    text-align: left;
    white-space: nowrap;
}
td {
    white-space: normal;
    word-break: break-word;
}
th {
    background: rgba(110, 118, 129, 0.12);
    font-weight: var(--font-weight-semibold, 600);
    position: sticky;
    top: 0;
    white-space: nowrap;
}
tr:nth-child(even) { background: rgba(110, 118, 129, 0.04); }

/* Remove outer borders when wrapped */
.table-wrapper table {
    border: none;
}
.table-wrapper table th:first-child,
.table-wrapper table td:first-child {
    border-left: none;
}
.table-wrapper table th:last-child,
.table-wrapper table td:last-child {
    border-right: none;
}
.table-wrapper table tr:first-child th {
    border-top: none;
}
.table-wrapper table tr:last-child td {
    border-bottom: none;
}

/* Horizontal rule */
hr {
    border: 0;
    height: 1px;
    background: var(--border-color-default, #30363d);
    margin: 1.5em 0;
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

/* Mermaid diagrams - fill available width */
.mermaid-container {
    margin: 1.25em 0;
    padding: 12px 4px;
    border: 1px solid var(--border-color-default, #30363d);
    border-radius: 8px;
    overflow-x: auto;
    overflow-y: hidden;
    min-height: 80px;
    -webkit-overflow-scrolling: touch;
    position: relative;
}

.mermaid-container svg {
    width: 100%;
    max-width: 100%;
    height: auto;
    display: block;
}

.mermaid-container .mermaid {
    width: 100%;
}

/* Mermaid node text readability */
.mermaid-container .nodeLabel,
.mermaid-container .edgeLabel,
.mermaid-container .label {
    font-family: var(--font-sans, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif) !important;
    font-size: 12px !important;
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
    padding: 20px;
}
.empty-state svg {
    width: 56px;
    height: 56px;
    margin-bottom: 14px;
    opacity: 0.4;
}
.empty-state h2 {
    border: none;
    color: var(--text-color-muted, #8b949e);
    font-size: 18px;
}
.empty-state p {
    max-width: 320px;
    line-height: 1.5;
    font-size: 13px;
}

/* Smooth scroll and transitions */
html { scroll-behavior: smooth; }

/* Scrollbar styling */
::-webkit-scrollbar { width: 6px; height: 6px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb {
    background: rgba(110, 118, 129, 0.25);
    border-radius: 3px;
}
::-webkit-scrollbar-thumb:hover { background: rgba(110, 118, 129, 0.45); }

/* Wide viewport: restore comfortable spacing */
@media (min-width: 720px) {
    .viewer-container {
        max-width: 860px;
        padding: 36px 32px;
    }
    h1 { font-size: 28px; }
    h2 { font-size: 22px; }
    h3 { font-size: 18px; }
    table { font-size: 13px; }
    th, td { padding: 8px 12px; }
    .mermaid-container { padding: 24px 20px; }
    pre { padding: 16px 20px; }
    pre code { font-size: 13px; }
}

/* Very narrow panels */
@media (max-width: 400px) {
    .viewer-container { padding: 16px 12px; }
    h1 { font-size: 20px; }
    h2 { font-size: 17px; }
    table { font-size: 11.5px; }
    th, td { padding: 5px 7px; }
    .mermaid-container { padding: 10px 8px; }
    pre { padding: 10px 12px; }
    pre code { font-size: 11.5px; }
}
</style>
</head>
<body>
<div class="viewer-container" id="content"></div>
<script>
(async () => {
    let currentVersion = ${initialVersion};
    let currentContent = ${escapedContent};
    const container = document.getElementById("content");

    function escapeForHtml(str) {
        return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    }

    function getRenderer() {
        const renderer = new marked.Renderer();
        let mermaidCount = 0;

        renderer.code = function({ text, lang }) {
            if (lang === "mermaid") {
                const id = "mermaid-" + (mermaidCount++);
                return '<div class="mermaid-container"><pre class="mermaid" id="' + id + '">' + text + '</pre></div>';
            }
            return '<pre><code class="language-' + (lang || "") + '">' + escapeForHtml(text) + '</code></pre>';
        };

        renderer.table = function(header, body) {
            return '<div class="table-wrapper"><table><thead>' + header + '</thead><tbody>' + body + '</tbody></table></div>';
        };

        return renderer;
    }

    function getMermaidConfig() {
        const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
        return {
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
                rankSpacing: 55,
                diagramPadding: 8,
                useMaxWidth: true,
                wrappingWidth: 200,
            },
            sequence: {
                diagramMarginX: 16,
                diagramMarginY: 16,
                actorMargin: 70,
                width: 160,
                height: 50,
                boxMargin: 10,
                boxTextMargin: 8,
                noteMargin: 10,
                messageMargin: 40,
                useMaxWidth: true,
            },
            gantt: {
                titleTopMargin: 20,
                barHeight: 22,
                barGap: 5,
                topPadding: 40,
                leftPadding: 80,
                useMaxWidth: true,
            },
            pie: { useMaxWidth: true },
            er: { useMaxWidth: true },
            gitGraph: { useMaxWidth: true },
        };
    }

    async function renderContent(content) {
        if (!content || content.trim() === "") {
            container.innerHTML = \`
                <div class="empty-state">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                        <path d="M14 2v6h6"/>
                        <path d="M16 13H8M16 17H8M10 9H8"/>
                    </svg>
                    <h2>Markdown Viewer</h2>
                    <p>Loading content\u2026</p>
                </div>\`;
            return;
        }

        marked.setOptions({ gfm: true, breaks: false });
        marked.use({ renderer: getRenderer() });

        container.innerHTML = marked.parse(content);

        mermaid.initialize(getMermaidConfig());
        try {
            await mermaid.run({ querySelector: ".mermaid" });
        } catch (e) {
            document.querySelectorAll(".mermaid[data-processed]").forEach(el => {
                if (!el.querySelector("svg")) {
                    el.innerHTML = "<pre><code>" + escapeForHtml(el.textContent) + "</code></pre>";
                }
            });
        }
    }

    // Initial render
    await renderContent(currentContent);

    // Poll for content updates (handles update_content/load_file actions)
    async function pollForUpdates() {
        try {
            const res = await fetch("/content");
            if (res.ok) {
                const data = await res.json();
                if (data.version > currentVersion) {
                    currentVersion = data.version;
                    currentContent = data.content;
                    if (data.title) {
                        document.title = data.title;
                    }
                    await renderContent(currentContent);
                }
            }
        } catch (e) {
            // Server may be shutting down, stop polling
            return;
        }
        setTimeout(pollForUpdates, 800);
    }

    // Start polling after a brief delay
    setTimeout(pollForUpdates, 600);
})();
</script>
</body>
</html>`;
}

async function startServer(instanceId) {
    const entry = { server: null, url: "", content: "", title: "Markdown Viewer", version: 0 };

    const server = createServer((req, res) => {
        if (req.method === "GET" && (req.url === "/" || req.url === "")) {
            res.setHeader("Content-Type", "text/html; charset=utf-8");
            res.end(renderViewerHtml(entry.content, entry.title, entry.version));
        } else if (req.method === "GET" && req.url === "/content") {
            res.setHeader("Content-Type", "application/json");
            res.setHeader("Cache-Control", "no-cache");
            res.end(JSON.stringify({ content: entry.content, title: entry.title, version: entry.version }));
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
            description: "A beautiful read-only markdown viewer with mermaid diagram rendering. Always pass the full markdown content when opening — the viewer renders it immediately with optimized typography and diagram layout. Content updates via actions are auto-refreshed.",
            inputSchema: {
                type: "object",
                properties: {
                    content: {
                        type: "string",
                        description: "The markdown content to render. Include any mermaid code blocks. The viewer polls for updates so content can also be pushed via update_content or load_file actions after opening.",
                    },
                    title: {
                        type: "string",
                        description: "Optional title for the viewer panel tab",
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
                        entry.version++;
                        return { success: true, message: "Content updated — viewer will refresh automatically." };
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
                            entry.version++;
                            return { success: true, message: `Loaded ${fileName} — viewer will refresh automatically.` };
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
                    entry.version++;
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
