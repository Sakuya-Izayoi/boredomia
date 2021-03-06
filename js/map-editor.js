let editor = {
	canInteract: false,
	mouseActive: false,
	mode: 'bl',
	availableModes: {
		bl: 'draw solid blocks',
		bg: 'draw background',
		fg: 'draw foreground (occlusion layer)',
		player: 'move default player position',
		tedraw: 'draw tile entities',
		teedit: 'edit tile entity data',
		resize: 'expand or crop the map',
	},
	availableTileEntityCodes: {
		none:       'null',
		banana:     '{"type":"score","sprite":"🍌","collect":true,"score":5}',
		appleRed:   '{"type":"score","sprite":"🍎","collect":true,"score":5}',
		appleGreen: '{"type":"score","sprite":"🍏","collect":true,"score":5}',
		candy:      '{"type":"score","sprite":"🍬","collect":true,"score":10}',
		melon:      '{"type":"score","sprite":"🍉","collect":true,"score":15}',
		grape:      '{"type":"score","sprite":"🍇","collect":true,"score":20}',
		pineapple:  '{"type":"score","sprite":"🍍","collect":true,"score":25}',
		pizza:      '{"type":"score","sprite":"🍕","collect":true,"score":30}',
		lolipop:    '{"type":"score","sprite":"🍭","collect":true,"score":35}',
		chocolate:  '{"type":"score","sprite":"🍫","collect":true,"score":40}',
		cake:       '{"type":"score","sprite":"🍰","collect":true,"score":50}',
		clover:     '{"type":"score","sprite":"🍀","collect":true,"score":100}',
		
		door:       '{"type":"portal","sprite":"woodendoor"}',
		warp:       '{"type":"portal","sprite":"warp"}',
		cave:       '{"type":"portal","sprite":"cavedoor"}',
		
		signpost:   '{"type":"sign","sprite":"signpost"}',
		signwall:   '{"type":"sign","sprite":"signwall"}',
		signrock:   '{"type":"sign","sprite":"signrock"}',
	},
	block: 3,
	button: 0,
	tileEntityCode: 'null',
}

canv.addEventListener('mousedown', (event) => {
	if (!editor.canInteract) return
	editor.button = event.button
	editor.mouseActive = true
	mouseInteract(event)
	event.preventDefault()
})

canv.addEventListener('mouseup', (event) => {
	if (!editor.canInteract) return
	if (editor.mouseActive) event.preventDefault()
	editor.mouseActive = false
})

canv.addEventListener('mousemove', (event) => {
	if (!editor.canInteract || !editor.mouseActive) return
	mouseInteract(event)
	event.preventDefault()
})

canv.addEventListener('contextmenu', (event) => {
	event.preventDefault()
})

canv.addEventListener('blur', (event) => {
	editor.mouseActive = false
})

function startEditor(lvlData) {
	g = {
		editor: true,
	}
	if (lvlData) {
		loadMap(lvlData)
	} else {
		createEmptyMap()
	}
	pl = {
        x: map.defaultPlayerPos.x,
		y: map.defaultPlayerPos.y,
		alive: true,
	}
	tileCache = null
	editor.canInteract = true
}

function saveMap() {
    let lvlData = {
        w: map.w,
        h: map.h,
        blData: Array.from(map.blData),
        bgData: Array.from(map.bgData),
        fgData: Array.from(map.fgData),
        
        defaultPlayerPos: map.defaultPlayerPos,
        tileEntityList: map.tileEntityList || [],
        entityList: map.entityList || [],
    }
    
	return JSON.stringify(lvlData)
}

function mouseInteract(event, primary) {
	let rect = canv.getBoundingClientRect()
	x = (event.pageX - rect.x) / rect.width
	y = (event.pageY - rect.y) / rect.height
	if (x < 0 || y < 0 || x >= 1 || y >= 1) return
	x = (x * w - w2) / tsz + pl.x
	y = (y * h - h2) / tsz + pl.y + camYOffset
	mapInteract(x, y, editor.button, primary)
}

function mapInteract(x, y, button) {
	let i = Math.floor(x)
	let j = Math.floor(y)
	let mode = editor.mode
	if (isOutOfMap(i, j) && mode != 'resize') return
	
	if (['bl', 'bg', 'fg'].includes(mode)) {
		let arr = map[mode + 'Data']
		if (button == 1) {
			// block pick
			editor.block = arr[index(i, j)]
			return
		}
		let value = (button == 2) ? 0 : editor.block
		arr[index(i, j)] = value
		resetTileCache(i, j, true)
	}
	
	if (mode == 'player') {
		map.defaultPlayerPos = {
			x: i + 0.5,
			y: j + 1,
			dir: +!!(x > i + 0.5),
		}
	}
	
	if (mode == 'tedraw' || mode == 'teedit') {
		let te = getTileEntity(i, j)
		let code = editor.tileEntityCode
		if (mode == 'teedit') {
			if (!te) return
			// mouse events are missed during prompt so reset mouse state manually
			editor.mouseActive = false
			code = prompt('Edit tileEntity code:', JSON.stringify(te))
			if (!code) return
		} else {
			if (button == 1) {
				// pick
				if (te) editor.tileEntityCode = JSON.stringify(te)
				return
			}
			if (button == 2) {
				// destroy
				destroyTileEntity(te)
				return
			}
		}
		
		let teNew = JSON.parse(code)
		if (!teNew) return
		destroyTileEntity(te)
		teNew.x = i
		teNew.y = j
		if (teNew.type === 'portal') {
			teNew.id = generateId()
		}
		addTileEntity(teNew)
		//resetTileCache(i, j, false)
	}
	
	if (mode == 'resize') {
		let dx = 0
		let dy = 0
		let nw = map.w
		let nh = map.h
		if (button == 2) {
			// crop map
			dx = (i == 0) ? -1 : 0
			dy = (j == 0) ? -1 : 0
			if (nw > 2) nw += (i == map.w - 1) ? -1 : dx
			if (nh > 2) nh += (j == map.h - 1) ? -1 : dy
		} else {
			// expand map
			dx = (i < 0) ? -i : 0
			dy = (j < 0) ? -j : 0
			nw += (i >= map.w) ? i - map.w + 1 : dx
			nh += (j >= map.h) ? j - map.h + 1 : dy
		}
		
		if (dx == 0 && dy == 0 && nw == map.w && nh == map.h) return
		resizeMap(dx, dy, nw, nh)
	}
}

function resetTileCache(i, j, blockUpdate) {
	requestTileUpdate(i, j, blockUpdate)
	if (blockUpdate) {
		if (isMapEdge(i, j)) tileCache = null
	}
}


function moveObject(obj, dx, dy) {
	obj.x += dx
	obj.y += dy
}

function resizeMap(dx, dy, nw, nh) {
	for (let prop of ['blData', 'bgData', 'fgData']) {
		let newArr = new Uint8ClampedArray(nw * nh)
		let oldArr = map[prop]
		for (let j = 0; j < nh; j++) {
			for (let i = 0; i < nw; i++) {
				newArr[j * nw + i] = oldArr[getValidIndex(i - dx, j - dy)]
			}
		}
		map[prop] = newArr
	}
	map.w = nw
	map.h = nh
	
	if (dx || dy) {
		// move all objects
		moveObject(map.defaultPlayerPos, dx, dy)
		moveObject(pl, dx, dy)
		
		for (let te of map.tileEntityList) {
			moveObject(te, dx, dy)
		}
	}
	
	for (let te of map.tileEntityList) {
		if (isOutOfMap(te.x, te.y)) {
			destroyTileEntity(te)
		}
	}
	
	// move player back into map
	let i = map.defaultPlayerPos.x - 0.5
	let j = map.defaultPlayerPos.y - 1
    if (j < 0) {
        j = 0
    }
    if (j >= map.h) {
        j = map.h - 1
    }
    if (i < 0) {
        i = 0
    }
    if (i >= map.w) {
        i = map.w - 1
    }
	map.defaultPlayerPos.x = i + 0.5
	map.defaultPlayerPos.y = j + 1
	
	preprocessMap(map)
}


function createEditorGUI() {
	let guiContainer = document.createElement('div')
	guiContainer.id = 'gui-container'
	
	function addComment(text) {
		let p = document.createElement('p')
		p.textContent = text
		guiContainer.appendChild(p)
	}
	
	addComment('Brush type:')
	let selMode = document.createElement('select')
	for (let mode in editor.availableModes) {
		let opt = document.createElement('option')
		opt.value = mode
		opt.textContent = editor.availableModes[mode]
		selMode.appendChild(opt)
	}
	selMode.value = editor.mode
	selMode.onchange = () => editor.mode = selMode.value
	guiContainer.appendChild(selMode)
	
	addComment('Selected block:')
	let selBlock = document.createElement('select')
	for (let b = 0; b < blockInfo.length; b++) {
		let info = blockInfo[b]
		let opt = document.createElement('option')
		opt.value = b
		opt.textContent = info.name
		opt.style.backgroundColor = info.color || blockSkyColor
		opt.style.color = '#fff'
		selBlock.appendChild(opt)
	}
	selBlock.value = editor.block
	selBlock.onchange = () => editor.block = selBlock.value
	guiContainer.appendChild(selBlock)
	
	addComment('Selected tile entity:')
	let selTE = document.createElement('select')
	for (let name in editor.availableTileEntityCodes) {
		let opt = document.createElement('option')
		opt.value = editor.availableTileEntityCodes[name]
		opt.textContent = name
		selTE.appendChild(opt)
	}
	selTE.onchange = () => editor.tileEntityCode = selTE.value
	guiContainer.appendChild(selTE)
	
	addComment('Load from file:')
	let btOpen = document.createElement('input')
	btOpen.type = 'file'
	btOpen.onchange = function() {
		let file = this.files[0]
		let fileReader = new FileReader()
		fileReader.onloadend = () => {
			try {
				startEditor(fileReader.result)
				lvlNameInput.value = file.name
			} catch(err) {
				alert('Failed to load lvl data: ' + err)
			}
		}
		fileReader.readAsText(file)
	}
	guiContainer.appendChild(btOpen)
	
	let btClear = document.createElement('input')
	btClear.type = 'button'
	btClear.onclick = () => startEditor()
	btClear.value = 'Clear map'
	guiContainer.appendChild(btClear)
	
	let btSave = document.createElement('input')
	btSave.type = 'button'
	btSave.onclick = () => {
		if (!map) {
			alert('Map is not loaded!')
			return
		}
		let lvlData = saveMap()
		let lvlName = lvlNameInput.value
		if (!lvlName) {
			lvlName = 'untitled'
		}
		downloadFile(lvlName, lvlData)
	}
	btSave.value = 'Save map as file'
	guiContainer.appendChild(btSave)
	
	addComment('Map name:')
	let lvlNameInput = document.createElement('input')
	lvlNameInput.type = 'text'
	lvlNameInput.value = 'lvl1'
	guiContainer.appendChild(lvlNameInput)
	
	let btLoad = document.createElement('input')
	btLoad.type = 'button'
	btLoad.onclick = () => {
		let lvlName = lvlNameInput.value
		loadLvl(lvlName)
			.then((data) => startEditor(data))
			.catch((error) => alert('Cannot get "' + lvlName + '.json" from "lvls" folder! ' + error))
	}
	btLoad.value = 'Load game lvl by name'
	guiContainer.appendChild(btLoad)
	
	// disable event processing by the game controls
	for (let name of ['keydown', 'keyup']) {
		lvlNameInput.addEventListener('keydown', (e) => e.stopPropagation())
	}
	
	document.body.appendChild(guiContainer)
}

createEditorGUI()

function generateId() {
	const alphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'
	const idLength = 5
	
	let id = ''
	for (let i = 0; i < idLength; i++) {
		id += alphabet[Math.floor(Math.random() * alphabet.length)]
	}
	return id
}

function downloadFile(name, data) {
	let a = document.createElement('a')
	a.href = 'data:application/json;base64,' + btoa(unescape(encodeURIComponent(data)))
	a.target = '_blank'
	a.download = name
	try {
		document.body.appendChild(a)
		a.click()
		document.body.removeChild(a)
	} catch(error) {
		console.log(error)
		window.open(data)
	}
}