/**
 * VisionSync Discovery Server
 * HTTP service discovery for visionOS clients
 */

import { createServer, Server, IncomingMessage, ServerResponse } from "http"
import { URL } from "url"
import type { ServiceDiscoveryResponse } from "./types"
import { getLocalIP, createWebSocketURL } from "./network-utils"

export class VisionDiscoveryServer {
	private server: Server | null = null
	private isRunning = false

	constructor(
		private readonly port: number,
		private readonly websocketPort: number,
		private readonly serviceName: string,
	) {}

	/**
	 * Start the discovery server
	 */
	async start(): Promise<void> {
		if (this.isRunning) {
			throw new Error("Discovery server is already running")
		}

		return new Promise((resolve, reject) => {
			this.server = createServer((req, res) => {
				// Enable CORS for all origins
				res.setHeader("Access-Control-Allow-Origin", "*")
				res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
				res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization")

				this.handleRequest(req, res)
			})

			this.server.listen(this.port, () => {
				this.isRunning = true
				console.log(`[VisionDiscovery] Server started on port ${this.port}`)
				resolve()
			})

			this.server.on("error", (error) => {
				console.error("[VisionDiscovery] Server error:", error)
				reject(error)
			})
		})
	}

	/**
	 * Stop the discovery server
	 */
	async stop(): Promise<void> {
		if (!this.isRunning || !this.server) {
			return
		}

		return new Promise((resolve) => {
			this.server!.close(() => {
				this.isRunning = false
				this.server = null
				console.log("[VisionDiscovery] Server stopped")
				resolve()
			})
		})
	}

	/**
	 * Handle HTTP requests
	 */
	private handleRequest(req: IncomingMessage, res: ServerResponse): void {
		const url = new URL(req.url || "/", `http://${req.headers.host}`)
		const method = req.method?.toUpperCase()

		// Handle CORS preflight
		if (method === "OPTIONS") {
			res.writeHead(200)
			res.end()
			return
		}

		// Route requests
		switch (url.pathname) {
			case "/discover":
				this.handleDiscovery(req, res)
				break
			case "/health":
				this.handleHealth(req, res)
				break
			case "/":
				this.handleRoot(req, res)
				break
			default:
				this.handleNotFound(req, res)
				break
		}
	}

	/**
	 * Handle service discovery request
	 */
	private handleDiscovery(req: IncomingMessage, res: ServerResponse): void {
		if (req.method !== "GET") {
			res.writeHead(405, { "Content-Type": "application/json" })
			res.end(JSON.stringify({ error: "Method not allowed" }))
			return
		}

		try {
			const localIP = getLocalIP()
			if (!localIP) {
				throw new Error("Unable to determine local IP address")
			}

			const response: ServiceDiscoveryResponse = {
				name: this.serviceName,
				websocket_url: createWebSocketURL(localIP, this.websocketPort),
				version: "1.0.0",
				platform: process.platform,
				app: "Roo Code",
				capabilities: ["ai_conversation", "trigger_send", "echo", "ping_pong"],
			}

			res.writeHead(200, {
				"Content-Type": "application/json",
				"Cache-Control": "no-cache",
			})
			res.end(JSON.stringify(response, null, 2))

			console.log(`[VisionDiscovery] Discovery request served: ${req.socket.remoteAddress}`)
		} catch (error) {
			console.error("[VisionDiscovery] Discovery error:", error)
			res.writeHead(500, { "Content-Type": "application/json" })
			res.end(
				JSON.stringify({
					error: "Internal server error",
					message: error instanceof Error ? error.message : "Unknown error",
				}),
			)
		}
	}

	/**
	 * Handle health check request
	 */
	private handleHealth(req: IncomingMessage, res: ServerResponse): void {
		const health = {
			status: "healthy",
			timestamp: new Date().toISOString(),
			service: this.serviceName,
			version: "1.0.0",
			uptime: process.uptime(),
		}

		res.writeHead(200, { "Content-Type": "application/json" })
		res.end(JSON.stringify(health, null, 2))
	}

	/**
	 * Handle root request
	 */
	private handleRoot(req: IncomingMessage, res: ServerResponse): void {
		const info = {
			service: "Roo Code Vision Sync Discovery",
			version: "1.0.0",
			endpoints: {
				discovery: "/discover",
				health: "/health",
			},
			websocket_port: this.websocketPort,
		}

		res.writeHead(200, { "Content-Type": "application/json" })
		res.end(JSON.stringify(info, null, 2))
	}

	/**
	 * Handle 404 requests
	 */
	private handleNotFound(req: IncomingMessage, res: ServerResponse): void {
		res.writeHead(404, { "Content-Type": "application/json" })
		res.end(
			JSON.stringify({
				error: "Not found",
				path: req.url,
				available_endpoints: ["/discover", "/health", "/"],
			}),
		)
	}

	/**
	 * Check if server is running
	 */
	get running(): boolean {
		return this.isRunning
	}

	/**
	 * Get current port
	 */
	get currentPort(): number {
		return this.port
	}

	/**
	 * Get service name
	 */
	get name(): string {
		return this.serviceName
	}
}
