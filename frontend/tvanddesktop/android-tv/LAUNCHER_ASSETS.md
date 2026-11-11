# Android TV launcher icons & TV banner

The Leanback launcher shows every TV app as a **320×180 banner** on the home
screen — not a rounded icon. Drop a 320×180 PNG that uses the MegaRadio brand
logo on a pink-to-black radial background here:

```
app/src/main/res/drawable-xhdpi/tv_banner.png     (320×180)
```

Also provide mipmap icons (only shown in Settings → Apps on Android TV):

```
app/src/main/res/mipmap-mdpi/ic_launcher.png       ( 48×48 )
app/src/main/res/mipmap-hdpi/ic_launcher.png       ( 72×72 )
app/src/main/res/mipmap-xhdpi/ic_launcher.png      ( 96×96 )
app/src/main/res/mipmap-xxhdpi/ic_launcher.png     (144×144)
app/src/main/res/mipmap-xxxhdpi/ic_launcher.png    (192×192)
```

Round-icon variants (`ic_launcher_round.png`) must live in the same folders.

### Generate from Figma / the existing brand logo

1. Export the MegaRadio brand logo (`frontend/tvanddesktop/apple-tv-and-macos/
   web-preview/public/images/path-8.svg` + wordmark) at **192×192** with
   transparent background.
2. Use Android Studio → Image Asset Studio:
   - File → New → Image Asset → **Launcher Icons (Adaptive and Legacy)**
   - Foreground: imported MegaRadio logo
   - Background: solid `#0E0E0E`
3. For the **TV Banner**, repeat but pick the "TV Banner" asset type. Use the
   wordmark + logo on a radial `#FF4199 → #0E0E0E` gradient matching the
   splash screen (`images/hand-crowd-disco-1.png`).

The banner and density-specific launcher images are included in this project.
Keep documentation outside `app/src/main/res`: Android's resource compiler
accepts drawable resources in that directory, not Markdown files.
