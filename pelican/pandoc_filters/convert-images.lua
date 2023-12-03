-- file: convert-images.lua
function Image(elem)
    -- Create an HTML string for the image
    local html_img = string.format('<div style="text-align: center;"><img src="%s" alt="%s" /><br><em>%s</em></div>', elem.src, pandoc.utils.stringify(elem.caption), pandoc.utils.stringify(elem.title))

    -- Return a RawInline containing the HTML string
    return pandoc.RawInline('html', html_img)
end
