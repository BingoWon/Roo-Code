/**
 * VisionSync Demo Server
 * Runs a persistent server for testing and demonstration
 */

import { VisionSyncService, VisionServiceEvent } from "./index"

async function startDemoServer() {
	console.log("🚀 Starting VisionSync Demo Server...")

	const service = new VisionSyncService({
		serviceName: "RooCode-Demo",
		port: 8765,
		discoveryPort: 8766,
		enabled: true,
		maxConnections: 10,
	})

	// Set up comprehensive event logging
	service.on(VisionServiceEvent.SERVICE_STARTED, (data) => {
		console.log("✅ Service started on ports:", data)
		const networkInfo = service.getNetworkInfo()
		if (networkInfo) {
			console.log(`🌐 WebSocket URL: ws://${networkInfo.localIP}:${data.port}`)
			console.log(`🔍 Discovery URL: http://${networkInfo.localIP}:${data.discoveryPort}/discover`)
			console.log(`📱 Network: ${networkInfo.networkSegment} (${networkInfo.interfaceName})`)
		}
	})

	service.on(VisionServiceEvent.SERVICE_STOPPED, () => {
		console.log("🛑 Service stopped")
	})

	service.on(VisionServiceEvent.CLIENT_CONNECTED, (data) => {
		console.log(`📱 Client connected: ${data.connection.id}`)
		console.log(`   Type: ${data.connection.clientType}`)
		console.log(`   Version: ${data.connection.version}`)
		console.log(`   Capabilities: ${data.connection.capabilities.join(", ")}`)
	})

	service.on(VisionServiceEvent.CLIENT_DISCONNECTED, (data) => {
		console.log(`📱 Client disconnected: ${data.connectionId}`)
		if (data.reason) {
			console.log(`   Reason: ${data.reason}`)
		}
	})

	service.on(VisionServiceEvent.MESSAGE_RECEIVED, (data) => {
		console.log(`💬 Message received from ${data.connectionId}:`)
		console.log(`   Type: ${data.message.type}`)
		if (data.message.type === "AIConversation") {
			const payload = (data.message as any).payload
			console.log(`   Session: ${payload.sessionId}`)
			console.log(`   Role: ${payload.role}`)
			console.log(`   Content: ${payload.content.substring(0, 100)}${payload.content.length > 100 ? "..." : ""}`)
		}
	})

	service.on(VisionServiceEvent.MESSAGE_SENT, (data) => {
		console.log(`📤 Message sent to ${data.connectionId}: ${data.message.type}`)
	})

	service.on(VisionServiceEvent.ERROR, (data) => {
		console.error(`❌ Error in ${data.context || "unknown context"}:`, data.error.message)
	})

	// Handle graceful shutdown
	const shutdown = async () => {
		console.log("\n🛑 Shutting down demo server...")
		try {
			await service.stop()
			console.log("✅ Demo server stopped gracefully")
			process.exit(0)
		} catch (error) {
			console.error("❌ Error during shutdown:", error)
			process.exit(1)
		}
	}

	process.on("SIGINT", shutdown)
	process.on("SIGTERM", shutdown)

	try {
		await service.start()

		console.log("\n📋 Demo Server Status:")
		const status = service.getStatus()
		console.log(`   Running: ${status.running}`)
		console.log(`   WebSocket Port: ${status.websocketPort}`)
		console.log(`   Discovery Port: ${status.discoveryPort}`)
		console.log(`   Max Connections: ${status.config.maxConnections}`)
		console.log(`   Service Name: ${status.config.serviceName}`)

		console.log("\n🎯 Ready for visionOS connections!")
		console.log("   Press Ctrl+C to stop the server")

		// Keep the server running
		await new Promise(() => {}) // Never resolves
	} catch (error) {
		console.error("❌ Failed to start demo server:", error)
		process.exit(1)
	}
}

// Start the demo server
startDemoServer().catch(console.error)
