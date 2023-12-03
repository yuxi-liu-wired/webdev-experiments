import panflute as pf

def process_images(elem, doc):
    if isinstance(elem, pf.Image):
        # Create a centered paragraph
        para = pf.Para(pf.Space, pf.Strong(elem), pf.Space)
        para.alignment = 'Center'
        
        # Add caption if available
        if elem.title:
            caption = pf.Para(pf.Emph(pf.Str(elem.title)))
            return [para, caption]

def main(doc=None):
    return pf.run_filter(process_images, doc=doc)

if __name__ == "__main__":
    main()
