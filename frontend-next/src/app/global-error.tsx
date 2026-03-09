"use client" // Error boundaries must be Client Components

import { useEffect } from "react"
import { Button } from "@/components/ui/button"
import { AlertCircle } from "lucide-react"

export default function GlobalError({
    error,
    reset,
}: {
    error: Error & { digest?: string }
    reset: () => void
}) {
    useEffect(() => {
        // Log the error to an error reporting service like Sentry or Logtail
        console.error("Global Error Caught:", error)
    }, [error])

    return (
        <html lang="en">
            <body>
                <div className="flex min-h-screen flex-col items-center justify-center p-6 text-center">
                    <div className="mb-6 rounded-full bg-red-100 p-6 dark:bg-red-900/20">
                        <AlertCircle className="h-12 w-12 text-red-600 dark:text-red-500" />
                    </div>
                    <h2 className="mb-2 text-2xl font-bold tracking-tight">Something went wrong!</h2>
                    <p className="mb-6 text-slate-500 dark:text-slate-400 max-w-md">
                        We encountered an unexpected error while processing your request. Our team has been notified.
                    </p>
                    <Button onClick={() => reset()} size="lg">
                        Try again
                    </Button>
                </div>
            </body>
        </html>
    )
}
