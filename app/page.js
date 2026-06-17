"use client"

import { useState, useRef, useEffect } from "react"

const ERASER_RADIUS = 6

// 8 columns × 7 rows colour grid
const PALETTE = [
  // Grayscale
  "#ffffff", "#d9d9d9", "#b3b3b3", "#808080", "#595959", "#333333", "#1a1a1a", "#000000",
  // Light tints
  "#ffcccc", "#ffddcc", "#ffffcc", "#ccffcc", "#ccffff", "#cce0ff", "#ddccff", "#ffccee",
  // Medium-light
  "#ff9999", "#ffbb88", "#ffee66", "#88ee88", "#66dddd", "#88aaff", "#bb88ff", "#ff99cc",
  // Medium
  "#ff5555", "#ff8833", "#ffcc00", "#44cc44", "#22cccc", "#4488ff", "#9955ff", "#ff5599",
  // Medium-dark
  "#cc0000", "#cc5500", "#aa8800", "#008800", "#007777", "#0044cc", "#6600cc", "#cc0066",
  // Dark
  "#880000", "#883300", "#665500", "#005500", "#004455", "#002288", "#440088", "#880044",
  // Very dark
  "#440000", "#441100", "#332200", "#003300", "#002233", "#001155", "#220044", "#330022",
]

function isColorLight(hex) {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return (r * 299 + g * 587 + b * 114) / 1000 >= 128
}

function pointToSegmentDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay
  const len2 = dx * dx + dy * dy
  if (len2 === 0) return Math.hypot(px - ax, py - ay)
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2))
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy))
}

function strokeHitsPoint(stroke, px, py) {
  const pts = stroke.points
  if (pts.length === 1) return Math.hypot(px - pts[0].x, py - pts[0].y) <= ERASER_RADIUS
  for (let i = 0; i < pts.length - 1; i++) {
    if (pointToSegmentDist(px, py, pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y) <= ERASER_RADIUS) return true
  }
  return false
}

export default function Home() {
  const [drawingBase64String, setDrawingBase64String] = useState("")
  const [isDrawing, setIsDrawing] = useState(false)
  const [currentColor, setCurrentColor] = useState("#ff4b81")
  const [recentColors, setRecentColors] = useState(["#ff4b81", "#000000", "#4b8bff", "#4bff81", "#ffeb3b", "#ff9800"])
  const [canUndo, setCanUndo] = useState(false)
  const [canRedo, setCanRedo] = useState(false)
  const [isErasing, setIsErasing] = useState(false)
  const [showPicker, setShowPicker] = useState(false)
  const canvasRef = useRef(null)
  const contextRef = useRef(null)
  const colorInputRef = useRef(null)
  const pickerRef = useRef(null)
  const historyRef = useRef([])
  const redoStackRef = useRef([])
  const strokesRef = useRef([])
  const currentStrokeRef = useRef(null)
  const erasedRef = useRef(false)

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
    historyRef.current = [{ imageData: context.getImageData(0, 0, canvas.width, canvas.height), strokes: [] }]
  }, [])

  // Close picker on outside click
  useEffect(() => {
    if (!showPicker) return
    const handler = (e) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target)) {
        setShowPicker(false)
      }
    }
    document.addEventListener("mousedown", handler)
    document.addEventListener("touchstart", handler)
    return () => {
      document.removeEventListener("mousedown", handler)
      document.removeEventListener("touchstart", handler)
    }
  }, [showPicker])

  const redrawStrokes = (strokes) => {
    const canvas = canvasRef.current
    const context = contextRef.current
    context.fillStyle = "white"
    context.fillRect(0, 0, canvas.width, canvas.height)
    strokes.forEach(stroke => {
      if (stroke.points.length === 0) return
      context.beginPath()
      context.strokeStyle = stroke.color
      context.lineWidth = 2
      context.lineCap = "round"
      context.lineJoin = "round"
      context.moveTo(stroke.points[0].x, stroke.points[0].y)
      stroke.points.slice(1).forEach(p => context.lineTo(p.x, p.y))
      context.stroke()
    })
    context.strokeStyle = currentColor
    context.lineWidth = 2
  }

  const saveSnapshot = () => {
    const canvas = canvasRef.current
    const context = contextRef.current
    historyRef.current.push({
      imageData: context.getImageData(0, 0, canvas.width, canvas.height),
      strokes: [...strokesRef.current],
    })
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
    if (isErasing) {
      erasedRef.current = false
      setIsDrawing(true)
      return
    }
    const ctx = contextRef.current
    ctx.strokeStyle = currentColor
    ctx.lineWidth = 2
    currentStrokeRef.current = { points: [{ x, y }], color: currentColor }
    ctx.beginPath()
    ctx.moveTo(x, y)
    setIsDrawing(true)
  }

  const draw = (e) => {
    if (!isDrawing) return
    e.preventDefault()
    const canvas = canvasRef.current
    const { x, y } = getPos(e, canvas)
    if (isErasing) {
      const newStrokes = strokesRef.current.filter(s => !strokeHitsPoint(s, x, y))
      if (newStrokes.length !== strokesRef.current.length) {
        strokesRef.current = newStrokes
        redrawStrokes(newStrokes)
        erasedRef.current = true
      }
      return
    }
    currentStrokeRef.current?.points.push({ x, y })
    contextRef.current.lineTo(x, y)
    contextRef.current.stroke()
  }

  const stopDrawing = (e) => {
    if (!isDrawing) return
    e?.preventDefault()
    setIsDrawing(false)
    const canvas = canvasRef.current
    if (isErasing) {
      if (erasedRef.current) {
        saveSnapshot()
        setDrawingBase64String(canvas.toDataURL("image/png"))
      }
      return
    }
    contextRef.current.closePath()
    const stroke = currentStrokeRef.current
    if (stroke && stroke.points.length > 0) {
      strokesRef.current = [...strokesRef.current, stroke]
    }
    currentStrokeRef.current = null
    saveSnapshot()
    setDrawingBase64String(canvas.toDataURL("image/png"))
  }

  const undo = () => {
    if (historyRef.current.length <= 1) return
    const canvas = canvasRef.current
    const context = contextRef.current
    redoStackRef.current.push(historyRef.current.pop())
    const prev = historyRef.current[historyRef.current.length - 1]
    context.putImageData(prev.imageData, 0, 0)
    strokesRef.current = [...prev.strokes]
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
    context.putImageData(next.imageData, 0, 0)
    strokesRef.current = [...next.strokes]
    setCanUndo(true)
    setCanRedo(redoStackRef.current.length > 0)
    setDrawingBase64String(canvas.toDataURL("image/png"))
  }

  const clearCanvas = () => {
    const canvas = canvasRef.current
    const context = contextRef.current
    context.fillStyle = "white"
    context.fillRect(0, 0, canvas.width, canvas.height)
    strokesRef.current = []
    historyRef.current = [{ imageData: context.getImageData(0, 0, canvas.width, canvas.height), strokes: [] }]
    redoStackRef.current = []
    setCanUndo(false)
    setCanRedo(false)
    setDrawingBase64String("")
  }

  const toggleEraser = () => setIsErasing(prev => !prev)

  const pickColor = (color) => {
    setCurrentColor(color)
    setRecentColors(prev => {
      const filtered = prev.filter(c => c !== color)
      return [color, ...filtered].slice(0, 6)
    })
    if (contextRef.current) {
      contextRef.current.strokeStyle = color
      contextRef.current.lineWidth = 2
    }
    setIsErasing(false)
    setShowPicker(false)
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

          {/* Colour button + recent swatches */}
          <div className="inline-flex items-center gap-2 relative" ref={pickerRef}>

            {/* Colour button that opens popup */}
            <button
              type="button"
              onClick={() => setShowPicker(prev => !prev)}
              className="px-3 py-1.5 rounded-lg font-semibold text-sm cursor-pointer transition ease-out duration-150 hover:opacity-85 active:opacity-70"
              style={{
                backgroundColor: currentColor,
                color: isColorLight(currentColor) ? "#111" : "#fff",
                border: `2px solid ${isColorLight(currentColor) ? "rgba(0,0,0,0.2)" : "rgba(255,255,255,0.25)"}`,
              }}
            >
              Colour
            </button>

            {/* Colour picker popup */}
            {showPicker && (
              <div className="absolute left-0 bottom-[calc(100%+8px)] z-50 bg-[#242424] border border-[#444] rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.6)] p-3 flex flex-col gap-2.5 min-w-[220px]">

                {/* Recently used */}
                <div>
                  <p className="text-[10px] uppercase tracking-wider opacity-50 mb-1.5 m-0">Recently used</p>
                  <div className="flex gap-1.5">
                    {recentColors.map((color, i) => (
                      <button
                        key={i}
                        onClick={() => pickColor(color)}
                        className={`w-7 h-7 rounded-md border-2 cursor-pointer transition-transform hover:scale-110 ${currentColor === color ? "border-white" : "border-[#555]"}`}
                        style={{ backgroundColor: color }}
                        aria-label={color}
                      />
                    ))}
                  </div>
                </div>

                <div className="h-px bg-[#444]" />

                {/* Colour grid */}
                <div>
                  <p className="text-[10px] uppercase tracking-wider opacity-50 mb-1.5 m-0">Colours</p>
                  <div className="grid grid-cols-8 gap-1">
                    {PALETTE.map((color, i) => (
                      <button
                        key={i}
                        onClick={() => pickColor(color)}
                        className={`w-6 h-6 rounded-sm border cursor-pointer transition-transform hover:scale-125 hover:z-10 relative ${currentColor === color ? "border-white scale-110" : "border-transparent hover:border-white"}`}
                        style={{ backgroundColor: color }}
                        aria-label={color}
                      />
                    ))}
                  </div>
                </div>

                <div className="h-px bg-[#444]" />

                {/* More colours (native picker) */}
                <button
                  type="button"
                  onClick={() => colorInputRef.current?.click()}
                  className="text-xs text-left opacity-60 hover:opacity-100 transition cursor-pointer bg-transparent border-none text-[#f5f5f5] p-0"
                >
                  More colours…
                </button>
                <input
                  ref={colorInputRef}
                  type="color"
                  value={currentColor}
                  onChange={e => pickColor(e.target.value)}
                  className="absolute opacity-0 w-0 h-0 pointer-events-none"
                  aria-hidden="true"
                />
              </div>
            )}

            {/* Recent colour swatches (always visible) */}
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
