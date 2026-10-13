import { parseReceiptText, type ReceiptGuess } from '@/utils/receiptParser'

/**
 * Reads a receipt photo on this device (Tesseract OCR). The photo never leaves
 * the phone; the first scan downloads the recognition engine and English model
 * (a few MB), which the browser then keeps.
 */
export async function readReceipt(image: Blob, onProgress?: (fraction: number) => void): Promise<ReceiptGuess> {
  const { createWorker } = await import('tesseract.js')
  const worker = await createWorker('eng', 1, {
    logger: (message) => {
      if (message.status === 'recognizing text') onProgress?.(message.progress)
    },
  })
  try {
    const { data } = await worker.recognize(image)
    return parseReceiptText(data.text)
  } finally {
    await worker.terminate()
  }
}
