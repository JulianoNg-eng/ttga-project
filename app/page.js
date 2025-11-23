"use client"

import { useState, useRef, useEffect } from "react"

export default function Home() {
  const [drawingBase64String, setDrawingBase64String] = useState("")
  const [isDrawing, setIsDrawing] = useState(false)
  const [currentColor, setCurrentColor] = useState("#ff4b81")
  const canvasRef = useRef(null)
  const contextRef = useRef(null)

  const colors = ["#ff4b81", "#000000", "#4b8bff", "#4bff81", "#ffeb3b", "#ff9800"]

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    // Match ESP32 screen size exactly: 160x128
    canvas.width = 160
    canvas.height = 128
    
    const context = canvas.getContext("2d")
    context.lineCap = "round"
    context.lineJoin = "round"
    context.lineWidth = 2
    context.strokeStyle = currentColor
    contextRef.current = context

    // Fill with white background
    context.fillStyle = "white"
    context.fillRect(0, 0, canvas.width, canvas.height)
  }, [])

  const startDrawing = (e) => {
    const canvas = canvasRef.current
    const rect = canvas.getBoundingClientRect()
    const x = (e.clientX - rect.left) * (canvas.width / rect.width)
    const y = (e.clientY - rect.top) * (canvas.height / rect.height)

    contextRef.current.beginPath()
    contextRef.current.moveTo(x, y)
    setIsDrawing(true)
  }

  const draw = (e) => {
    if (!isDrawing) return

    const canvas = canvasRef.current
    const rect = canvas.getBoundingClientRect()
    const x = (e.clientX - rect.left) * (canvas.width / rect.width)
    const y = (e.clientY - rect.top) * (canvas.height / rect.height)

    contextRef.current.lineTo(x, y)
    contextRef.current.stroke()
  }

  const stopDrawing = () => {
    if (!isDrawing) return
    
    contextRef.current.closePath()
    setIsDrawing(false)

    // Convert canvas to base64 as simple 8-bit PNG
    const canvas = canvasRef.current
    const base64 = canvas.toDataURL("image/png")
    setDrawingBase64String(base64)
  }

  const clearCanvas = () => {
    const canvas = canvasRef.current
    const context = contextRef.current
    context.fillStyle = "white"
    context.fillRect(0, 0, canvas.width, canvas.height)
    setDrawingBase64String("")
  }

  const changeColor = (color) => {
    setCurrentColor(color)
    if (contextRef.current) {
      contextRef.current.strokeStyle = color
    }
  }

  const handleSubmitData = async () => {
    if (!drawingBase64String) {
      alert("Please draw something first!")
      return
    }

    // Strip the data:image/png;base64, prefix
    const base64Only = drawingBase64String.split(',')[1] || drawingBase64String

    try {
      const response = await fetch("https://gpftjspiqmbyotvdayro.supabase.co/functions/v1/insert-drawing", {
        method: "POST",
        headers: {
          "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdwZnRqc3BpcW1ieW90dmRheXJvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM3ODU4OTQsImV4cCI6MjA3OTM2MTg5NH0.9njRkviMnnfAcj6l8DmXP5fSjuC95aQZWhLDwGO-N0w",
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ drawingBase64String: base64Only })
      })

      if (response.ok) {
        alert("Drawing sent successfully! 💕")
        clearCanvas()
      } else {
        alert("Failed to send drawing. Please try again.")
      }
    } catch (error) {
      console.error("Error:", error)
      alert("An error occurred. Please try again.")
    }
  }

  return (
    <div className="min-h-screen bg-[#111] text-[#f5f5f5] flex items-center justify-center p-4 font-sans">
      <div className="bg-[#1b1b1b] rounded-2xl p-6 max-w-2xl w-full flex flex-col gap-4 shadow-[0_12px_30px_rgba(0,0,0,0.35)]">

        <p className="m-0 text-center text-[1.6rem] font-semibold">
          Drawing for K!
        </p>

        <canvas
          ref={canvasRef}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          className="w-full aspect-[5/4] border-[3px] border-black rounded-lg bg-white block cursor-crosshair touch-none"
        />

        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="inline-flex items-center gap-2">
            <span className="text-sm opacity-90">Colour</span>
            <div className="flex gap-2">
              {colors.map((color) => (
                <button
                  key={color}
                  onClick={() => changeColor(color)}
                  className={`w-7 h-7 rounded-full border-2 cursor-pointer transition-transform hover:scale-110 ${
                    currentColor === color ? "border-white scale-110" : "border-[#333]"
                  }`}
                  style={{ backgroundColor: color }}
                  aria-label={`Select ${color} color`}
                />
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={clearCanvas}
            className="px-4 py-2 rounded-full bg-[#333] text-white font-semibold text-sm cursor-pointer transition ease-out duration-150 hover:bg-[#444]"
          >
            Clear
          </button>
        </div>

        <button
          type="button"
          onClick={handleSubmitData}
          className="px-4 py-2.5 rounded-full bg-[#ff4b81] text-white font-semibold text-sm cursor-pointer transition ease-out duration-150 transform hover:bg-[#ff6b94] hover:-translate-y-[1px] hover:shadow-[0_4px_14px_rgba(255,75,129,0.45)] active:translate-y-[1px] active:shadow-none"
        >
          Send to her
        </button>
      </div>
    </div>
  )
}