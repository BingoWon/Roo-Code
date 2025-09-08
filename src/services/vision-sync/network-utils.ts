/**
 * VisionSync Network Utilities
 * Modern network discovery and IP management
 */

import { networkInterfaces } from "os"
import type { NetworkInfo } from "./types"

/**
 * Get the primary local IP address
 */
export function getLocalIP(): string | null {
	const interfaces = networkInterfaces()

	// Priority order: en0 (WiFi), en1 (Ethernet), others
	const priorityOrder = ["en0", "en1", "eth0", "wlan0"]

	for (const interfaceName of priorityOrder) {
		const networkInterface = interfaces[interfaceName]
		if (networkInterface) {
			for (const alias of networkInterface) {
				if (alias.family === "IPv4" && !alias.internal) {
					return alias.address
				}
			}
		}
	}

	// Fallback: find any non-internal IPv4 address
	for (const [name, networkInterface] of Object.entries(interfaces)) {
		if (networkInterface) {
			for (const alias of networkInterface) {
				if (alias.family === "IPv4" && !alias.internal) {
					return alias.address
				}
			}
		}
	}

	return null
}

/**
 * Get the primary network interface name
 */
export function getPrimaryInterfaceName(): string | null {
	const interfaces = networkInterfaces()
	const priorityOrder = ["en0", "en1", "eth0", "wlan0"]

	for (const interfaceName of priorityOrder) {
		const networkInterface = interfaces[interfaceName]
		if (networkInterface) {
			for (const alias of networkInterface) {
				if (alias.family === "IPv4" && !alias.internal) {
					return interfaceName
				}
			}
		}
	}

	return null
}

/**
 * Calculate network segment from IP address
 */
export function calculateNetworkSegment(ip: string): string {
	try {
		const parts = ip.split(".")
		if (parts.length === 4) {
			return `${parts[0]}.${parts[1]}.${parts[2]}.0/24`
		}
	} catch {
		// Ignore parsing errors
	}
	return "Unknown"
}

/**
 * Check if the system is online (has network connectivity)
 */
export async function checkNetworkConnectivity(): Promise<boolean> {
	try {
		// Try to resolve a reliable DNS name
		const { lookup } = await import("dns/promises")
		await lookup("google.com")
		return true
	} catch {
		return false
	}
}

/**
 * Get comprehensive network information
 */
export async function getNetworkInfo(): Promise<NetworkInfo> {
	const localIP = getLocalIP() ?? "Unknown"
	const interfaceName = getPrimaryInterfaceName() ?? "Unknown"
	const networkSegment = calculateNetworkSegment(localIP)
	const isOnline = await checkNetworkConnectivity()

	return {
		localIP,
		networkSegment,
		interfaceName,
		isOnline,
	}
}

/**
 * Check if a port is available
 */
export async function isPortAvailable(port: number): Promise<boolean> {
	return new Promise((resolve) => {
		const { createServer } = require("net")
		const server = createServer()

		server.listen(port, () => {
			server.close(() => resolve(true))
		})

		server.on("error", () => resolve(false))
	})
}

/**
 * Find an available port starting from the given port
 */
export async function findAvailablePort(startPort: number, maxAttempts = 10): Promise<number | null> {
	for (let i = 0; i < maxAttempts; i++) {
		const port = startPort + i
		if (await isPortAvailable(port)) {
			return port
		}
	}
	return null
}

/**
 * Validate IP address format
 */
export function isValidIPAddress(ip: string): boolean {
	const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/
	return ipv4Regex.test(ip)
}

/**
 * Get all available network interfaces with their IP addresses
 */
export function getAllNetworkInterfaces(): Array<{ name: string; ip: string; internal: boolean }> {
	const interfaces = networkInterfaces()
	const result: Array<{ name: string; ip: string; internal: boolean }> = []

	for (const [name, networkInterface] of Object.entries(interfaces)) {
		if (networkInterface) {
			for (const alias of networkInterface) {
				if (alias.family === "IPv4") {
					result.push({
						name,
						ip: alias.address,
						internal: alias.internal,
					})
				}
			}
		}
	}

	return result
}

/**
 * Create a WebSocket URL from host and port
 */
export function createWebSocketURL(host: string, port: number): string {
	return `ws://${host}:${port}`
}

/**
 * Create an HTTP URL from host and port
 */
export function createHTTPURL(host: string, port: number, path = ""): string {
	const basePath = path.startsWith("/") ? path : `/${path}`
	return `http://${host}:${port}${basePath}`
}
