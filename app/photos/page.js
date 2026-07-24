"use client"

import { useState, useEffect, useRef } from "react"
import Nav from "../Nav"
import { insertPhoto, fetchDrawings, deleteDrawing } from "../supabaseClient"

// Rebuild a data URL from stored base64 by sniffing the image type from its signature.
function base64ToDataUrl(b64) {
  const mime = b64.startsWith("/9j/")
    ? "image/jpeg"
    : b64.startsWith("R0lGOD")
    ? "image/gif"
    : b64.startsWith("UklGR")
    ? "image/webp"
    : "image/png"
  return `data:${mime};base64,${b64}`
}

// ESP32 ST7796S TFT resolution in landscape — photos are resized to exactly
// this so they draw 1:1 on the frame and stay small enough for its RAM.
const PHOTO_WIDTH = 480
const PHOTO_HEIGHT = 320

// Decode the file, downscale/center-crop it to PHOTO_WIDTH x PHOTO_HEIGHT on a
// canvas, and re-encode as a JPEG data URL. A 480x320 JPEG (~40-80KB) instead
// of PNG (400KB+) keeps photos inside the ESP32's heap to fetch + decode.
function fileToJpegDataUrl(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement("canvas")
      canvas.width = PHOTO_WIDTH
      canvas.height = PHOTO_HEIGHT
      const ctx = canvas.getContext("2d")
      ctx.imageSmoothingEnabled = true
      ctx.imageSmoothingQuality = "high"
      ctx.fillStyle = "white"
      ctx.fillRect(0, 0, PHOTO_WIDTH, PHOTO_HEIGHT)
      // "cover": scale to fill the frame, center-cropping the overflow.
      const scale = Math.max(PHOTO_WIDTH / img.naturalWidth, PHOTO_HEIGHT / img.naturalHeight)
      const dw = img.naturalWidth * scale
      const dh = img.naturalHeight * scale
      ctx.drawImage(img, (PHOTO_WIDTH - dw) / 2, (PHOTO_HEIGHT - dh) / 2, dw, dh)
      URL.revokeObjectURL(url)
      resolve(canvas.toDataURL("image/jpeg", 0.85))
    }
    img.onerror = (error) => {
      URL.revokeObjectURL(url)
      reject(error)
    }
    img.src = url
  })
}

export default function Photos() {
  const [photos, setPhotos] = useState([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef(null)

  const loadPhotos = async () => {
    try {
      setLoading(true)
      const rows = await fetchDrawings("photo")
      setPhotos(rows)
    } catch (error) {
      console.error("Error:", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadPhotos()
  }, [])

  const handleUpload = async (e) => {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return
    setUploading(true)
    try {
      for (const file of files) {
        const dataUrl = await fileToJpegDataUrl(file)
        await insertPhoto(dataUrl)
      }
      await loadPhotos()
    } catch (error) {
      console.error("Error:", error)
      alert("Failed to upload one or more photos. Please try again.")
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  const handleDelete = async (id) => {
    try {
      await deleteDrawing(id)
      setPhotos((prev) => prev.filter((p) => p.id !== id))
    } catch (error) {
      console.error("Error:", error)
      alert("Failed to delete photo. Please try again.")
    }
  }

  return (
    <div className="min-h-screen bg-[#111] text-[#f5f5f5] flex items-center justify-center p-3 sm:p-4 font-sans">
      <div className="bg-[#1b1b1b] rounded-2xl p-4 sm:p-6 max-w-2xl w-full flex flex-col gap-3 sm:gap-4 shadow-[0_12px_30px_rgba(0,0,0,0.35)]">

        <Nav />

        <p className="m-0 text-center text-[1.3rem] sm:text-[1.6rem] font-semibold">
          Photos for K!
        </p>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handleUpload}
          className="hidden"
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="px-4 py-3 sm:py-2.5 rounded-full bg-[#ff4b81] text-white font-semibold text-sm cursor-pointer transition ease-out duration-150 transform hover:bg-[#ff6b94] hover:-translate-y-[1px] hover:shadow-[0_4px_14px_rgba(255,75,129,0.45)] active:translate-y-[1px] active:shadow-none disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {uploading ? "Uploading…" : "Upload photos"}
        </button>

        {loading ? (
          <p className="m-0 text-center text-sm opacity-60 py-8">Loading…</p>
        ) : photos.length === 0 ? (
          <p className="m-0 text-center text-sm opacity-60 py-8">No photos yet.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
            {photos.map((photo) => (
              <div
                key={photo.id}
                className="relative group aspect-[3/2] rounded-lg overflow-hidden border border-[#333] bg-[#242424]"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={base64ToDataUrl(photo.drawing_data)}
                  alt="Uploaded photo"
                  className="w-full h-full object-cover"
                />
                <button
                  type="button"
                  onClick={() => handleDelete(photo.id)}
                  className="absolute top-1.5 right-1.5 w-8 h-8 flex items-center justify-center rounded-full bg-black/60 text-white font-semibold text-base cursor-pointer transition ease-out duration-150 hover:bg-black/80 active:bg-black"
                  aria-label="Delete photo"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
