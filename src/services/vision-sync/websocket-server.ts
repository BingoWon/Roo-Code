/**
 * VisionSync WebSocket Server
 * Modern WebSocket server implementation for visionOS communication
 */

import { WebSocketServer, WebSocket } from "ws"
import { EventEmitter } from "events"
import { randomUUID } from "crypto"
import type { VisionConnection, VisionMessage, VisionServiceEventData } from "./types"
import { VisionServiceEvent, ConnectionState } from "./types"
import { MessageFactory, serializeMessage, deserializeMessage, validateMessage, isSystemMessage } from "./message-utils"

interface ClientConnection {
	id: string
	socket: WebSocket
	connection: VisionConnection
	lastPing: number
	pingInterval?: NodeJS.Timeout
}

export class VisionWebSocketServer extends EventEmitter {
	private server: WebSocketServer | null = null
	private clients = new Map<string, ClientConnection>()
	private readonly pingInterval = 30000 // 30 seconds
	private readonly pongTimeout = 5000 // 5 seconds
	private isRunning = false

	constructor(
		private readonly port: number,
		private readonly maxConnections: number = 10,
	) {
		super()
	}

	/**
	 * Start the WebSocket server
	 */
	async start(): Promise<void> {
		if (this.isRunning) {
			throw new Error("WebSocket server is already running")
		}

		return new Promise((resolve, reject) => {
			this.server = new WebSocketServer({
				port: this.port,
				perMessageDeflate: false,
			})

			this.server.on("listening", () => {
				this.isRunning = true
				this.emit(VisionServiceEvent.SERVICE_STARTED, {
					port: this.port,
					discoveryPort: 0, // Will be set by the main service
				})
				resolve()
			})

			this.server.on("error", (error) => {
				this.emit(VisionServiceEvent.ERROR, { error, context: "WebSocket server startup" })
				reject(error)
			})

			this.server.on("connection", (socket, request) => {
				this.handleConnection(socket, request)
			})
		})
	}

	/**
	 * Stop the WebSocket server
	 */
	async stop(): Promise<void> {
		if (!this.isRunning || !this.server) {
			return
		}

		// Close all client connections
		for (const client of this.clients.values()) {
			this.disconnectClient(client.id, "Server shutdown")
		}

		return new Promise((resolve) => {
			this.server!.close(() => {
				this.isRunning = false
				this.server = null
				this.emit(VisionServiceEvent.SERVICE_STOPPED, {})
				resolve()
			})
		})
	}

	/**
	 * Handle new WebSocket connection
	 */
	private handleConnection(socket: WebSocket, request: any): void {
		// Check connection limit
		if (this.clients.size >= this.maxConnections) {
			const rejectMessage = MessageFactory.connectionRejected("Server at maximum capacity")
			socket.send(serializeMessage(rejectMessage))
			socket.close(1013, "Server at maximum capacity")
			return
		}

		const clientId = randomUUID()
		const now = new Date()

		// Create initial connection info (will be updated after handshake)
		const connection: VisionConnection = {
			id: clientId,
			clientType: "unknown",
			version: "unknown",
			capabilities: [],
			connectedAt: now,
			lastActivity: now,
			state: ConnectionState.CONNECTING,
		}

		const client: ClientConnection = {
			id: clientId,
			socket,
			connection,
			lastPing: Date.now(),
		}

		this.clients.set(clientId, client)

		// Set up socket event handlers
		socket.on("message", (data) => this.handleMessage(clientId, data))
		socket.on("close", (code, reason) => this.handleDisconnection(clientId, code, reason))
		socket.on("error", (error) => this.handleSocketError(clientId, error))
		socket.on("pong", () => this.handlePong(clientId))

		// Start ping interval
		client.pingInterval = setInterval(() => this.sendPing(clientId), this.pingInterval)

		console.log(`[VisionWebSocket] New connection: ${clientId}`)
	}

	/**
	 * Handle incoming message from client
	 */
	private handleMessage(clientId: string, data: any): void {
		const client = this.clients.get(clientId)
		if (!client) return

		try {
			const dataString = Buffer.isBuffer(data) ? data.toString() : String(data)
			const message = deserializeMessage(dataString)

			if (!validateMessage(message)) {
				throw new Error("Invalid message format")
			}

			// Update last activity
			client.connection = {
				...client.connection,
				lastActivity: new Date(),
			}

			this.emit(VisionServiceEvent.MESSAGE_RECEIVED, { connectionId: clientId, message })

			// Handle specific message types
			this.processMessage(clientId, message)
		} catch (error) {
			console.error(`[VisionWebSocket] Message processing error for ${clientId}:`, error)
			this.emit(VisionServiceEvent.ERROR, {
				error: error as Error,
				context: `Message processing for client ${clientId}`,
			})
		}
	}

	/**
	 * Process specific message types
	 */
	private processMessage(clientId: string, message: VisionMessage): void {
		const client = this.clients.get(clientId)
		if (!client) return

		switch (message.type) {
			case "ClientHandshake":
				this.handleHandshake(clientId, message)
				break

			case "Ping":
				this.sendMessage(clientId, MessageFactory.pong())
				break

			case "Echo":
				this.sendMessage(clientId, MessageFactory.echo(message.payload.message))
				break

			default:
				// For AI messages and other types, just emit the event
				// The main service will handle the business logic
				break
		}
	}

	/**
	 * Handle client handshake
	 */
	private handleHandshake(clientId: string, message: any): void {
		const client = this.clients.get(clientId)
		if (!client) return

		// Update connection info with handshake data
		client.connection = {
			...client.connection,
			clientType: message.clientType,
			version: message.version,
			capabilities: message.capabilities,
			state: ConnectionState.CONNECTED,
		}

		// Send connection accepted response
		const acceptedMessage = MessageFactory.connectionAccepted(clientId, {
			name: "Roo Code",
			version: "1.0.0",
			platform: process.platform,
			capabilities: ["ai_conversation", "trigger_send", "echo"],
		})

		this.sendMessage(clientId, acceptedMessage)

		// Emit connection event
		this.emit(VisionServiceEvent.CLIENT_CONNECTED, { connection: client.connection })

		console.log(`[VisionWebSocket] Client handshake completed: ${clientId} (${message.clientType})`)
	}

	/**
	 * Handle client disconnection
	 */
	private handleDisconnection(clientId: string, code: number, reason: Buffer): void {
		this.disconnectClient(clientId, reason.toString() || `Code: ${code}`)
	}

	/**
	 * Handle socket error
	 */
	private handleSocketError(clientId: string, error: Error): void {
		console.error(`[VisionWebSocket] Socket error for ${clientId}:`, error)
		this.emit(VisionServiceEvent.ERROR, { error, context: `Socket error for client ${clientId}` })
		this.disconnectClient(clientId, error.message)
	}

	/**
	 * Handle pong response
	 */
	private handlePong(clientId: string): void {
		const client = this.clients.get(clientId)
		if (client) {
			client.lastPing = Date.now()
		}
	}

	/**
	 * Send ping to client
	 */
	private sendPing(clientId: string): void {
		const client = this.clients.get(clientId)
		if (!client) return

		// Check if client is still responsive
		if (Date.now() - client.lastPing > this.pingInterval + this.pongTimeout) {
			this.disconnectClient(clientId, "Ping timeout")
			return
		}

		client.socket.ping()
	}

	/**
	 * Send message to specific client
	 */
	sendMessage(clientId: string, message: VisionMessage): boolean {
		const client = this.clients.get(clientId)
		if (!client || client.socket.readyState !== WebSocket.OPEN) {
			return false
		}

		try {
			const serialized = serializeMessage(message)
			client.socket.send(serialized)

			if (!isSystemMessage(message)) {
				this.emit(VisionServiceEvent.MESSAGE_SENT, { connectionId: clientId, message })
			}

			return true
		} catch (error) {
			console.error(`[VisionWebSocket] Failed to send message to ${clientId}:`, error)
			return false
		}
	}

	/**
	 * Broadcast message to all connected clients
	 */
	broadcast(message: VisionMessage): number {
		let sentCount = 0
		for (const clientId of this.clients.keys()) {
			if (this.sendMessage(clientId, message)) {
				sentCount++
			}
		}
		return sentCount
	}

	/**
	 * Disconnect a client
	 */
	private disconnectClient(clientId: string, reason?: string): void {
		const client = this.clients.get(clientId)
		if (!client) return

		// Clear ping interval
		if (client.pingInterval) {
			clearInterval(client.pingInterval)
		}

		// Close socket if still open
		if (client.socket.readyState === WebSocket.OPEN) {
			client.socket.close(1000, reason)
		}

		// Remove from clients map
		this.clients.delete(clientId)

		// Emit disconnection event
		this.emit(VisionServiceEvent.CLIENT_DISCONNECTED, { connectionId: clientId, reason })

		console.log(`[VisionWebSocket] Client disconnected: ${clientId} (${reason || "Unknown reason"})`)
	}

	/**
	 * Get all connected clients
	 */
	getConnections(): VisionConnection[] {
		return Array.from(this.clients.values()).map((client) => client.connection)
	}

	/**
	 * Get connection by ID
	 */
	getConnection(clientId: string): VisionConnection | null {
		return this.clients.get(clientId)?.connection || null
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
}
