import java.awt.image.BufferedImage;
import java.nio.file.Path;
import javax.imageio.ImageIO;

final class ButtonPixelControl {
    public static void main(String[] args) throws Exception {
        // Captured from the iPhone Review changes screen with a three-point margin.
        var screen = ImageIO.read(Path.of(args[0]).toFile());
        var observed = NativeButtonPixels.count(screen, 360, 69, 3, 3, 357, 66, 0xbde8be, 0x18211d);
        if (observed.get("pixels") != 200718 || observed.get("fill") != 171032 || observed.get("label") != 24743)
            throw new AssertionError("Captured Button colors changed: " + observed);
        var image = new BufferedImage(8, 6, BufferedImage.TYPE_INT_RGB);
        int fill = 0x345678, label = 0xabcdef;
        // A 2x device: grid [1,1][3,2] covers eight screen pixels.
        for (int y = 2; y < 4; y++)
            for (int x = 2; x < 6; x++) image.setRGB(x, y, fill);
        image.setRGB(5, 3, label);
        image.setRGB(6, 3, label);
        var counts = NativeButtonPixels.count(image, 4, 3, 1, 1, 3, 2, fill, label);
        if (counts.get("pixels") != 8 || counts.get("fill") != 7 || counts.get("label") != 1)
            throw new AssertionError("Wrong cropped colors: " + counts);
        if (!Integer.valueOf(4).equals(counts.get("gridWidth")) || !Integer.valueOf(3).equals(counts.get("gridHeight")))
            throw new AssertionError("Missing coordinate grid for replay: " + counts);
        image.setRGB(5, 3, fill);
        var missing = NativeButtonPixels.count(image, 4, 3, 1, 1, 3, 2, fill, label);
        if (missing.get("label") != 0) throw new AssertionError("Counted label outside Button");
    }
}
