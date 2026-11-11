// Apple's top-shelf images must contain no alpha channel, including opaque alpha.
import CoreGraphics
import ImageIO
import Foundation

for file in CommandLine.arguments.dropFirst() {
    let url = URL(fileURLWithPath: file)
    guard let source = CGImageSourceCreateWithURL(url as CFURL, nil),
          let image = CGImageSourceCreateImageAtIndex(source, 0, nil),
          let context = CGContext(data: nil, width: image.width, height: image.height,
              bitsPerComponent: 8, bytesPerRow: image.width * 4,
              space: CGColorSpaceCreateDeviceRGB(),
              bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue) else {
        fatalError("Unable to read top-shelf image: \(file)")
    }
    let bounds = CGRect(x: 0, y: 0, width: image.width, height: image.height)
    context.setFillColor(CGColor(gray: 14.0 / 255.0, alpha: 1))
    context.fill(bounds)
    context.draw(image, in: bounds)
    guard let opaque = context.makeImage(),
          let destination = CGImageDestinationCreateWithURL(url as CFURL, "public.png" as CFString, 1, nil) else {
        fatalError("Unable to encode top-shelf image: \(file)")
    }
    CGImageDestinationAddImage(destination, opaque, nil)
    guard CGImageDestinationFinalize(destination) else { fatalError("Unable to save \(file)") }
}
