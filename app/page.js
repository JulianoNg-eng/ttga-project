"use client"

import { useState, useRef, useEffect } from "react"

const INITIAL_COLORS = ["#ff4b81", "#000000", "#4b8bff", "#4bff81", "#ffeb3b", "#ff9800"]

function isColorLight(hex) {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return (r * 299 + g * 587 + b * 114) / 1000 >= 128
}

export default function Home() {
  const [drawingBase64String, setDrawingBase64String] = useState("")
  const [isDrawing, setIsDrawing] = useState(false)
  const [currentColor, setCurrentColor] = useState(INITIAL_COLORS[0])
  const [recentColors, setRecentColors] = useState(INITIAL_COLORS)
  const [canUndo, setCanUndo] = useState(false)
  const [canRedo, setCanRedo] = useState(false)
  const [isErasing, setIsErasing] = useState(false)
  const canvasRef = useRef(null)
  const contextRef = useRef(null)
  const colorInputRef = useRef(null)
  const historyRef = useRef([])
  const redoStackRef = useRef([])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    canvas.width = 160
    canvas.height = 128

    const context = canvas.getContext("2d")
    context.lineCap = "round"
    context.lineJoin = "round"
    context.lineWidth = 2
    context.strokeStyle = currentColor
    contextRef.current = context

    context.fillStyle = "white"
    context.fillRect(0, 0, canvas.width, canvas.height)

    historyRef.current = [context.getImageData(0, 0, canvas.width, canvas.height)]
  }, [])

  const saveSnapshot = () => {
    const canvas = canvasRef.current
    const context = contextRef.current
    historyRef.current.push(context.getImageData(0, 0, canvas.width, canvas.height))
    redoStackRef.current = []
    setCanUndo(true)
    setCanRedo(false)
  }

  const getPos = (e, canvas) => {
    const rect = canvas.getBoundingClientRect()
    const source = e.touches ? e.touches[0] : e
    return {
      x: (source.clientX - rect.left) * (canvas.width / rect.width),
      y: (source.clientY - rect.top) * (canvas.height / rect.height),
    }
  }

  const startDrawing = (e) => {
    e.preventDefault()
    const canvas = canvasRef.current
    const { x, y } = getPos(e, canvas)
    contextRef.current.beginPath()
    contextRef.current.moveTo(x, y)
    setIsDrawing(true)
  }

  const draw = (e) => {
    if (!isDrawing) return
    e.preventDefault()
    const canvas = canvasRef.current
    const { x, y } = getPos(e, canvas)
    contextRef.current.lineTo(x, y)
    contextRef.current.stroke()
  }

  const stopDrawing = (e) => {
    if (!isDrawing) return
    e?.preventDefault()
    contextRef.current.closePath()
    setIsDrawing(false)

    const canvas = canvasRef.current
    saveSnapshot()
    setDrawingBase64String(canvas.toDataURL("image/png"))
  }

  const undo = () => {
    if (historyRef.current.length <= 1) return
    const canvas = canvasRef.current
    const context = contextRef.current
    redoStackRef.current.push(historyRef.current.pop())
    const prev = historyRef.current[historyRef.current.length - 1]
    context.putImageData(prev, 0, 0)
    const isBlank = historyRef.current.length === 1
    setCanUndo(!isBlank)
    setCanRedo(true)
    setDrawingBase64String(isBlank ? "" : canvas.toDataURL("image/png"))
  }

  const redo = () => {
    if (redoStackRef.current.length === 0) return
    const canvas = canvasRef.current
    const context = contextRef.current
    const next = redoStackRef.current.pop()
    historyRef.current.push(next)
    context.putImageData(next, 0, 0)
    setCanUndo(true)
    setCanRedo(redoStackRef.current.length > 0)
    setDrawingBase64String(canvas.toDataURL("image/png"))
  }

  const clearCanvas = () => {
    const canvas = canvasRef.current
    const context = contextRef.current
    context.fillStyle = "white"
    context.fillRect(0, 0, canvas.width, canvas.height)
    historyRef.current = [context.getImageData(0, 0, canvas.width, canvas.height)]
    redoStackRef.current = []
    setCanUndo(false)
    setCanRedo(false)
    setDrawingBase64String("")
  }

  const toggleEraser = () => {
    const ctx = contextRef.current
    if (!ctx) return
    if (isErasing) {
      ctx.globalCompositeOperation = "source-over"
      ctx.strokeStyle = currentColor
      ctx.lineWidth = 2
      setIsErasing(false)
    } else {
      ctx.globalCompositeOperation = "destination-out"
      ctx.lineWidth = 6
      setIsErasing(true)
    }
  }

  const pickColor = (color) => {
    setCurrentColor(color)
    setRecentColors(prev => {
      const filtered = prev.filter(c => c !== color)
      return [color, ...filtered].slice(0, 6)
    })
    if (contextRef.current) {
      if (isErasing) {
        contextRef.current.globalCompositeOperation = "source-over"
        contextRef.current.lineWidth = 2
        setIsErasing(false)
      }
      contextRef.current.strokeStyle = color
    }
  }

  const handleSubmitData = async () => {
    if (!drawingBase64String) {
      alert("Please draw something first!")
      return
    }

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
    <div className="min-h-screen bg-[#111] text-[#f5f5f5] flex items-center justify-center p-3 sm:p-4 font-sans">
      <div className="bg-[#1b1b1b] rounded-2xl p-4 sm:p-6 max-w-2xl w-full flex flex-col gap-3 sm:gap-4 shadow-[0_12px_30px_rgba(0,0,0,0.35)]">

        <p className="m-0 text-center text-[1.3rem] sm:text-[1.6rem] font-semibold">
          Drawing for K!
        </p>

        <canvas
          ref={canvasRef}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
          className={`w-full aspect-[5/4] border-[3px] border-black rounded-lg bg-white block touch-none ${isErasing ? "cursor-cell" : "cursor-crosshair"}`}
        />

        <div className="flex items-center justify-between gap-2 flex-wrap">

          {/* Colour picker button + recent swatches */}
          <div className="inline-flex items-center gap-2">
            <button
              type="button"
              onClick={() => colorInputRef.current?.click()}
              className="px-3 py-1.5 rounded-lg border-2 border-transparent font-semibold text-sm cursor-pointer transition ease-out duration-150 hover:opacity-85 active:opacity-70"
              style={{
                backgroundColor: currentColor,
                color: isColorLight(currentColor) ? "#111" : "#fff",
                borderColor: isColorLight(currentColor) ? "rgba(0,0,0,0.15)" : "rgba(255,255,255,0.2)",
              }}
            >
              Colour
            </button>

            {/* Hidden native colour input */}
            <input
              ref={colorInputRef}
              type="color"
              value={currentColor}
              onChange={e => pickColor(e.target.value)}
              className="absolute opacity-0 w-0 h-0 pointer-events-none"
              aria-hidden="true"
            />

            <div className="flex gap-1.5 sm:gap-2">
              {recentColors.map((color, i) => (
                <button
                  key={i}
                  onClick={() => pickColor(color)}
                  className={`w-8 h-8 sm:w-7 sm:h-7 rounded-full border-2 cursor-pointer transition-transform hover:scale-110 ${
                    currentColor === color && !isErasing ? "border-white scale-110" : "border-[#444]"
                  }`}
                  style={{ backgroundColor: color }}
                  aria-label={`Select colour ${color}`}
                />
              ))}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={undo}
              disabled={!canUndo}
              className="w-9 h-9 flex items-center justify-center rounded-full bg-[#333] text-white font-semibold text-base cursor-pointer transition ease-out duration-150 hover:bg-[#444] active:bg-[#555] disabled:opacity-30 disabled:cursor-not-allowed"
              aria-label="Undo"
            >
              ↩
            </button>
            <button
              type="button"
              onClick={redo}
              disabled={!canRedo}
              className="w-9 h-9 flex items-center justify-center rounded-full bg-[#333] text-white font-semibold text-base cursor-pointer transition ease-out duration-150 hover:bg-[#444] active:bg-[#555] disabled:opacity-30 disabled:cursor-not-allowed"
              aria-label="Redo"
            >
              ↪
            </button>
            <button
              type="button"
              onClick={toggleEraser}
              className={`px-4 py-2 rounded-full font-semibold text-sm cursor-pointer transition ease-out duration-150 ${
                isErasing
                  ? "bg-white text-[#111] hover:bg-gray-200 active:bg-gray-300"
                  : "bg-[#333] text-white hover:bg-[#444] active:bg-[#555]"
              }`}
            >
              Eraser
            </button>
            <button
              type="button"
              onClick={clearCanvas}
              className="px-4 py-2 rounded-full bg-[#333] text-white font-semibold text-sm cursor-pointer transition ease-out duration-150 hover:bg-[#444] active:bg-[#555]"
            >
              Clear
            </button>
          </div>
        </div>

        <button
          type="button"
          onClick={handleSubmitData}
          className="px-4 py-3 sm:py-2.5 rounded-full bg-[#ff4b81] text-white font-semibold text-sm cursor-pointer transition ease-out duration-150 transform hover:bg-[#ff6b94] hover:-translate-y-[1px] hover:shadow-[0_4px_14px_rgba(255,75,129,0.45)] active:translate-y-[1px] active:shadow-none"
        >
          Send to her
        </button>
      </div>
    </div>
  )
}
