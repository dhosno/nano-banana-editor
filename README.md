# 🍌 Nano Banana Editor

**An AI-Powered Iterative Image Editor using Google's Gemini 2.5 Flash Image API**

![Next.js](https://img.shields.io/badge/Next.js-15.5.2-000000?style=flat-square&logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6?style=flat-square&logo=typescript)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.0-38B2AC?style=flat-square&logo=tailwind-css)
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

- **Framework**: Next.js 15.5.2 with App Router
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
git clone https://github.com/warpdotdev/nano-banana-editor.git
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
- **Request body size.** Vercel rejects function request bodies larger than **4.5 MB** with a `413 FUNCTION_PAYLOAD_TOO_LARGE` before the route handler runs, so the API cannot return a helpful error. The client therefore refuses uploads over **4 MB** (`MAX_IMAGE_BYTES` in `src/app/page.tsx`), leaving headroom for multipart overhead. The same check runs on each iteration, because every generated PNG becomes the next request's input and can be larger than the image it replaced. If you need bigger images, that requires a different upload path (for example direct-to-blob uploads), not a bigger limit.

### Other Platforms

The app is a standard Next.js application and can be deployed to any platform that supports Node.js. The `maxDuration` export and the 4 MB client-side upload guard are Vercel-specific; other hosts may allow larger bodies or longer requests.

## 🤖 Cloud Factory Automation

This repository consumes Cloud Factory skills from the canonical [`warpdotdev-demos/cloud-factory-demo`](https://github.com/warpdotdev-demos/cloud-factory-demo) repository.

To install or refresh the Triage and Implementation skills and workflow templates locally, run:

```bash
./scripts/bootstrap-cloud-factory.sh
```

The bootstrap script uses `npx skills install` to install the canonical skills into this repo and copies the workflow templates from `cloud-factory-demo`. Configure the `WARP_API_KEY` GitHub Actions secret before enabling the workflows.

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

**Built with ❤️ by the Warp team**
