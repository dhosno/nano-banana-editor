# 🍌 Nano Banana Editor

**An AI-Powered Iterative Image Editor using Google's Gemini 2.5 Flash Image API**

![Next.js](https://img.shields.io/badge/Next.js-16.3.2-000000?style=flat-square&logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?style=flat-square&logo=typescript)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-4-38B2AC?style=flat-square&logo=tailwind-css)
![Google AI](https://img.shields.io/badge/Google%20AI-Gemini%202.5-4285F4?style=flat-square&logo=google)

## ✨ Features

- **🖼️ Smart Image Upload**: Drag & drop or click to upload thumbnails
- **🤖 AI-Powered Editing**: Uses Google's Gemini 2.5 Flash Image ("Nano Banana") API for intelligent image modifications
- **🔄 Iterative Workflow**: Each generated image becomes the new base for further editing
- **📚 Visual History**: Bottom timeline showing all previous versions with click-to-revert
- **⚡ Real-time Processing**: Async API calls with loading states and progress feedback
- **🎨 Modern UI**: Clean, responsive interface built with Tailwind CSS
- **🔒 Secure**: API keys managed through Google Cloud Secret Manager

## 🚀 How It Works

1. **Upload** a thumbnail image
2. **Describe** your desired changes in natural language
3. **Process** with AI - Nano Banana generates your edited image
4. **Iterate** - the result becomes your new base image for further edits
5. **Navigate** through your editing history and revert to any previous version

### Example Editing Session:
- Original: Photo of a person
- Edit 1: "make the hat black" → generates image with black hat
- Edit 2: "add sunglasses" → generates image with black hat + sunglasses  
- Edit 3: "change background to sunset" → generates final image with all modifications
- **Click any thumbnail** to revert to that version and continue editing from there

## 🛠️ Tech Stack

- **Framework**: Next.js 16.3.2 with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **AI API**: Google Gemini 2.5 Flash Image ([@google/genai](https://www.npmjs.com/package/@google/genai))
- **Image Processing**: HTML5 Canvas + FileReader API
- **Deployment**: Vercel-ready

## 🏃‍♂️ Quick Start

### Prerequisites
- Node.js 24.x (pinned via `engines.node` in `package.json`; this is also the Node major Vercel builds with)
- Google Cloud account with Generative AI API access
- Gemini API key

### Installation

```bash
# Clone the repository
git clone https://github.com/warpdotdev-demos/nano-banana-editor.git
cd nano-banana-editor

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
# Add your Google Generative AI API key to .env.local
```

### Environment Setup

Create a `.env.local` file:

```env
# Get your API key from: https://ai.google.dev/gemini-api/docs/api-key
GOOGLE_GENERATIVE_AI_API_KEY=your_api_key_here
```

### Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to start editing images!

## 🏗️ Architecture

### Frontend (`/src/app/page.tsx`)
- React hooks for state management (image history, current image, loading states)
- File upload handling with drag & drop support
- Real-time form validation and submission
- Responsive image display with history timeline

### Backend (`/src/app/api/process-image/route.ts`)
- Next.js API route handling image processing requests
- Integration with Google Gemini 2.5 Flash Image API
- Base64 image encoding/decoding for API communication
- Error handling and response formatting

### Key Features Implementation

**Iterative Editing Workflow**:
```typescript
// After successful API response:
setSelectedImage(result.generatedImage);  // Replace current image
setImageHistory(prev => [...prev, previousImage]);  // Save to history
setInstructions("");  // Clear for next edit
```

**History Management**:
```typescript
// Click to revert truncates history (like git reset)
const revertToHistoryImage = (historyItem, index) => {
  setImageHistory(prev => prev.slice(0, index));  // Truncate
  setSelectedImage(historyItem.image);  // Revert
};
```

## 🎯 API Integration

The app integrates with Google's Gemini 2.5 Flash Image API ("Nano Banana"):

```typescript
const response = await genAI.models.generateContent({
  model: 'gemini-2.5-flash-image-preview',
  contents: [{
    parts: [
      { text: instructions },
      { inlineData: { mimeType: file.type, data: base64Data } }
    ]
  }]
});
```

## 🐛 Debugging Features

This project includes debugging capabilities using the Puppeteer MCP server:
- Live page inspection for UI bugs
- Real-time CSS debugging
- Image rendering diagnostics
- Console log monitoring

## 🌟 Recent Fixes

- **History Thumbnails**: Fixed black square rendering by correcting CSS overlay transparency
- **Stack Behavior**: Fixed history to properly truncate instead of append when reverting
- **Image Handling**: Improved data URL processing with regular `<img>` tags

## 🚀 Deployment

### Vercel (Recommended)

The deploy itself has to be done by you, with your own Vercel account — the repository only ships the configuration needed for that deploy to succeed.

#### 1. Verify the build locally

```bash
npm ci
npm run build
```

Production builds run `next build --turbopack` (see the `build` script). Vercel runs this same command, so a local failure is a deploy failure.

#### 2. Import the project into Vercel

Either import the Git repository from the [Vercel dashboard](https://vercel.com/new) (**Add New… → Project → Import Git Repository**), or link an existing checkout from the CLI:

```bash
npm i -g vercel
vercel link
```

Vercel detects Next.js automatically: no build command, output directory, or install command overrides are needed, and no `vercel.json` is required.

#### 3. Set the environment variable

`GOOGLE_GENERATIVE_AI_API_KEY` must be set for **each** environment you deploy to — Production, Preview, and Development. Without it, `/api/process-image` returns `500 Google API key not configured`.

In the dashboard: **Project Settings → Environment Variables**. Or from the CLI:

```bash
vercel env add GOOGLE_GENERATIVE_AI_API_KEY production
vercel env add GOOGLE_GENERATIVE_AI_API_KEY preview
vercel env add GOOGLE_GENERATIVE_AI_API_KEY development
```

See `.env.example` for the local equivalent (`.env.local`). Changing an environment variable requires a redeploy to take effect.

#### 4. Deploy

```bash
vercel --prod
```

Or just push to the default branch once the Git integration is connected.

#### Node.js version

`package.json` pins `engines.node` to `24.x`, which Vercel honors and which overrides the Node.js version selected in **Project Settings → Build and Deployment**. Vercel currently supports the `20.x`, `22.x`, and `24.x` majors; change the pin if you need a different one.

#### Platform limits to be aware of

- **Function timeout.** `src/app/api/process-image/route.ts` exports `maxDuration = 300` (seconds) and `runtime = 'nodejs'`. Gemini image generation is awaited synchronously, so the request stays open for the whole generation and the default timeout is not enough. 300s is the maximum allowed on the Hobby plan, and is also valid on Pro and Enterprise (which permit more). Hobby only reaches 300s with fluid compute, which is enabled by default for new projects; on a legacy project with fluid compute disabled the ceiling is 60s and the build rejects a higher value — lower `maxDuration` to `60` if that happens.
- **Request body size.** Vercel rejects function request bodies larger than **4.5 MB** with a `413 FUNCTION_PAYLOAD_TOO_LARGE` before the route handler runs, so the API cannot return a helpful error. The client therefore refuses uploads over **4 MB** (`MAX_IMAGE_BYTES` in `src/app/page.tsx`), leaving headroom for multipart overhead. The same check runs on each iteration, because every generated PNG becomes the next request's input and can be larger than the image it replaced.
- **Response body size.** The 4.5 MB cap applies to the response body too, and the client-side guard **cannot** prevent that side. `/api/process-image` returns the generated image as base64 inside JSON, which is roughly 1.33x the binary size, so the response exceeds the cap once a generated PNG is larger than about 3.3 MB — reachable even when the input was within the 4 MB limit, because the size of a generated image is not a function of the size of the input. When it happens the platform kills the response before any client-side check can run, and the browser reports the generic "Error: Failed to submit form" (the 413 body is not JSON, so parsing the response throws). If you hit this, the fix is a different transport — returning a URL to blob storage instead of inline base64 — not a smaller upload limit.

### Other Platforms

The app is a standard Next.js application and can be deployed to any platform that supports Node.js. The `maxDuration` export and the 4 MB client-side upload guard are Vercel-specific; other hosts may allow larger bodies or longer requests.

## Codex Issue Factory

This repository is a runnable, self-contained issue factory:

```text
GitHub issue
  -> Codex triage
  -> factory state label + comment
  -> Codex build/implementation when ready
  -> read-only Codex issue-satisfaction evaluation
  -> isolated lint, unit-test, and production-build testing
  -> Codex translates acceptance criteria into a bounded scenario
  -> Playwright tests that scenario against the running built application
  -> commit, branch, and pull request
  -> isolated pull-request testing
  -> human review
```

GitHub stores the factory state on each issue with one of five labels:

- `factory:ready`
- `factory:needs-info`
- `factory:wait`
- `factory:pr-open`
- `factory:done`

The workflow is [`.github/workflows/codex-factory.yml`](.github/workflows/codex-factory.yml). It uses the official [`openai/codex-action`](https://github.com/openai/codex-action), pinned to an immutable commit. Build, evaluation, deterministic testing, scenario preparation, browser testing, and publishing run in separate jobs. Codex receives the OpenAI key but no write credential; generated code runs only on fresh, isolated runners without factory secrets or persisted Git credentials. The evaluator returns `pass` or `needs-human`; a `needs-human` result or `not-applicable` browser scenario opens a draft PR. Evaluation is advisory and never substitutes for required human approval. The workflow never merges.

“Put in scenario” is not a stage name used by the original demo. Its closest equivalent is the [computer-use behavior verification stage](https://www.warp.dev/blog/how-to-build-a-cloud-software-factory-computer-use-verification): exercise acceptance criteria against the running product and retain evidence. Here, Codex derives a small acceptance scenario from the issue and candidate diff using a strict safe-operation schema. A trusted Playwright runner then starts the production build on an internal Docker network, exercises the scenario without external credentials or internet access, and uploads a screenshot plus machine-readable result. Backend-only or externally dependent behavior is recorded explicitly as `not-applicable` instead of being reported as verified.

### Enable the factory

1. Enable GitHub Issues and GitHub Actions for the repository.
2. Add an OpenAI API key as the repository Actions secret `OPENAI_API_KEY`.
3. Allow GitHub Actions to create pull requests.
4. Protect `main`: require the `validate` status check, require one approving
   review, dismiss stale approvals, require approval of the most recent push
   by someone other than its pusher, and require branches to be up to date.
5. Open an issue as a repository user with write access. The factory starts automatically.

To start the factory on an existing issue:

```bash
npm run factory -- 123
```

If a later PR check sits on **workflow awaiting approval**, GitHub is blocking a bot-opened PR. Approve that specific Actions run while logged in as a repo admin:

```bash
gh api -X POST "repos/$(gh repo view --json nameWithOwner --jq .nameWithOwner)/actions/runs/<run-id>/approve"
```

The run id is on the Actions page for **Codex PR Validation**. A PR review thumbs-up does not start it.

Or dispatch it directly:

```bash
gh workflow run codex-factory.yml --ref main -f issue_number=123
```

When triage applies `factory:needs-info`, editing the issue or adding a comment as a user with write access reruns triage with a bounded snapshot of the issue and its latest comments. Other public issue authors do not start the factory automatically.

Candidate patches cannot change workflows, prompts, Codex instructions, factory controllers, dependency manifests, or validation configuration. Factory runs must use the protected default-branch workflow revision. Runs are serialized per issue, duplicate open factory PRs are rejected, every job has a timeout, and the factory stops at a pull request for human review. Browser evidence is attached to the PR as an Actions artifact. [`.github/workflows/pr-validation.yml`](.github/workflows/pr-validation.yml) validates every PR in isolated lint, test, and build phases. Each phase starts from the same immutable source archive in a disposable filesystem with candidate network access disabled, so one phase cannot rewrite the code seen by the next. Same-repository owner, member, and collaborator PRs may acquire changed dependencies without running lifecycle scripts; external PRs must keep dependency and validation controls unchanged and run against the trusted base dependencies. For bot-authored factory PRs, validation additionally verifies an immutable Actions attestation that binds the trusted source revision, run, issue, and head SHA; installs dependencies from the trusted base before applying the diff; and moves the linked issue to `factory:done` or back to `factory:wait` when the PR closes.

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Google AI team for the amazing Gemini 2.5 Flash Image API
- Next.js team for the excellent framework
- Tailwind CSS for the utility-first styling approach

---

**Built for experimenting with iterative Gemini image editing.**
