function write_obj_str(factory/*:WriteObjStrFactory*/) {
	return function write_str(wb/*:Workbook*/, o/*:WriteOpts*/)/*:string*/ {
		var idx = 0;
		if(o.sheet) {
			if(typeof o.sheet == "number") idx = o.sheet;
			else idx = wb.SheetNames.indexOf(o.sheet);
			if(!wb.SheetNames[idx]) throw new Error("Sheet not found: " + o.sheet + " : " + (typeof o.sheet));
		}
		return factory.from_sheet(wb.Sheets[wb.SheetNames[idx]], o, wb);
	};
}

var write_htm_str = write_obj_str(HTML_);
var write_csv_str = write_obj_str({from_sheet:sheet_to_csv});
var write_slk_str = write_obj_str(typeof SYLK !== "undefined" ? SYLK : {});
var write_dif_str = write_obj_str(typeof DIF !== "undefined" ? DIF : {});
var write_prn_str = write_obj_str(typeof PRN !== "undefined" ? PRN : {});
var write_rtf_str = write_obj_str(typeof RTF !== "undefined" ? RTF : {});
var write_txt_str = write_obj_str({from_sheet:sheet_to_txt});
var write_dbf_buf = write_obj_str(typeof DBF !== "undefined" ? DBF : {});
var write_eth_str = write_obj_str(typeof ETH !== "undefined" ? ETH : {});
var write_wk1_buf = write_obj_str(typeof WK_ !== "undefined" ? {from_sheet:WK_.sheet_to_wk1} : {});

function write_cfb_ctr(cfb/*:CFBContainer*/, o/*:WriteOpts*/)/*:any*/ {
	switch(o.type) {
		case "base64": case "binary": break;
		case "buffer": case "array": o.type = ""; break;
		case "file": return write_dl(o.file, CFB.write(cfb, {type:has_buf ? 'buffer' : ""}));
		case "string": throw new Error("'string' output type invalid for '" + o.bookType + "' files");
		default: throw new Error("Unrecognized type " + o.type);
	}
	return CFB.write(cfb, o);
}

/*:: declare var encrypt_agile:any; */
function write_zip_type(wb/*:Workbook*/, opts/*:?WriteOpts*/)/*:any*/ {
	var o = dup(opts||{});
	var z = write_zip(wb, o);
	return write_zip_denouement(z, o);
}
function write_zip_typeXLSX(wb/*:Workbook*/, opts/*:?WriteOpts*/)/*:any*/ {
	var o = dup(opts||{});
	var z = write_zip_xlsx(wb, o);
	return write_zip_denouement(z, o);
}
function write_zip_denouement(z/*:any*/, o/*:?WriteOpts*/)/*:any*/ {
	var oopts = {};
	var ftype = has_buf ? "nodebuffer" : (typeof Uint8Array !== "undefined" ? "array" : "string");
	if(o.compression) oopts.compression = 'DEFLATE';
	if(o.password) oopts.type = ftype;
	else switch(o.type) {
		case "base64": oopts.type = "base64"; break;
		case "binary": oopts.type = "string"; break;
		case "string": throw new Error("'string' output type invalid for '" + o.bookType + "' files");
		case "buffer":
		case "file": oopts.type = ftype; break;
		default: throw new Error("Unrecognized type " + o.type);
	}
	var out = z.FullPaths ? CFB.write(z, {fileType:"zip", type: /*::(*/{"nodebuffer": "buffer", "string": "binary"}/*:: :any)*/[oopts.type] || oopts.type, compression: !!o.compression}) : z.generate(oopts);
	if(typeof Deno !== "undefined") {
		if(typeof out == "string") {
			if(o.type == "binary" || o.type == "base64") return out;
			out = new Uint8Array(s2ab(out));
		}
	}
/*jshint -W083 */
	if(o.password && typeof encrypt_agile !== 'undefined') return write_cfb_ctr(encrypt_agile(out, o.password), o); // eslint-disable-line no-undef
/*jshint +W083 */
	if(o.type === "file") return write_dl(o.file, out);
	return o.type == "string" ? utf8read(/*::(*/out/*:: :any)*/) : out;
}

function write_cfb_type(wb/*:Workbook*/, opts/*:?WriteOpts*/)/*:any*/ {
	var o = opts||{};
	var cfb/*:CFBContainer*/ = write_xlscfb(wb, o);
	return write_cfb_ctr(cfb, o);
}

function write_string_type(out/*:string*/, opts/*:WriteOpts*/, bom/*:?string*/)/*:any*/ {
	if(!bom) bom = "";
	var o = bom + out;
	switch(opts.type) {
		case "base64": return Base64.encode(utf8write(o));
		case "binary": return utf8write(o);
		case "string": return out;
		case "file": return write_dl(opts.file, o, 'utf8');
		case "buffer": {
			if(has_buf) return Buffer_from(o, 'utf8');
			else if(typeof TextEncoder !== "undefined") return new TextEncoder().encode(o);
			else return write_string_type(o, {type:'binary'}).split("").map(function(c) { return c.charCodeAt(0); });
		}
	}
	throw new Error("Unrecognized type " + opts.type);
}

function write_stxt_type(out/*:string*/, opts/*:WriteOpts*/)/*:any*/ {
	switch(opts.type) {
		case "base64": return Base64.encode(out);
		case "binary": return out;
		case "string": return out; /* override in sheet_to_txt */
		case "file": return write_dl(opts.file, out, 'binary');
		case "buffer": {
			if(has_buf) return Buffer_from(out, 'binary');
			else return out.split("").map(function(c) { return c.charCodeAt(0); });
		}
	}
	throw new Error("Unrecognized type " + opts.type);
}

/* TODO: test consistency */
function write_binary_type(out, opts/*:WriteOpts*/)/*:any*/ {
	switch(opts.type) {
		case "string":
		case "base64":
		case "binary":
			var bstr = "";
			// $FlowIgnore
			for(var i = 0; i < out.length; ++i) bstr += String.fromCharCode(out[i]);
			return opts.type == 'base64' ? Base64.encode(bstr) : opts.type == 'string' ? utf8read(bstr) : bstr;
		case "file": return write_dl(opts.file, out);
		case "buffer": return out;
		default: throw new Error("Unrecognized type " + opts.type);
	}
}

function writeSyncXLSX(wb/*:Workbook*/, opts/*:?WriteOpts*/) {
	reset_cp();
	check_wb(wb);
	var o = dup(opts||{});
	if(o.cellStyles) { o.cellNF = true; o.sheetStubs = true; }
	if(o.type == "array") { o.type = "binary"; var out/*:string*/ = (writeSyncXLSX(wb, o)/*:any*/); o.type = "array"; return s2ab(out); }
	return write_zip_typeXLSX(wb, o);
}

function writeSync(wb/*:Workbook*/, opts/*:?WriteOpts*/) {
	reset_cp();
	check_wb(wb);
	var o = dup(opts||{});
	if(o.cellStyles) { o.cellNF = true; o.sheetStubs = true; }
	if(o.type == "array") { o.type = "binary"; var out/*:string*/ = (writeSync(wb, o)/*:any*/); o.type = "array"; return s2ab(out); }
	switch(o.bookType || 'xlsb') {
		case 'xml':
		case 'xlml': return write_string_type(write_xlml(wb, o), o);
		case 'slk':
		case 'sylk': return write_string_type(write_slk_str(wb, o), o);
		case 'htm':
		case 'html': return write_string_type(write_htm_str(wb, o), o);
		case 'txt': return write_stxt_type(write_txt_str(wb, o), o);
		case 'csv': return write_string_type(write_csv_str(wb, o), o, "\ufeff");
		case 'dif': return write_string_type(write_dif_str(wb, o), o);
		case 'dbf': return write_binary_type(write_dbf_buf(wb, o), o);
		case 'prn': return write_string_type(write_prn_str(wb, o), o);
		case 'rtf': return write_string_type(write_rtf_str(wb, o), o);
		case 'eth': return write_string_type(write_eth_str(wb, o), o);
		case 'fods': return write_string_type(write_ods(wb, o), o);
		case 'wk1': return write_binary_type(write_wk1_buf(wb, o), o);
		case 'wk3': return write_binary_type(WK_.book_to_wk3(wb, o), o);
		case 'biff2': if(!o.biff) o.biff = 2; /* falls through */
		case 'biff3': if(!o.biff) o.biff = 3; /* falls through */
		case 'biff4': if(!o.biff) o.biff = 4; return write_binary_type(write_biff_buf(wb, o), o);
		case 'biff5': if(!o.biff) o.biff = 5; /* falls through */
		case 'biff8':
		case 'xla':
		case 'xls': if(!o.biff) o.biff = 8; return write_cfb_type(wb, o);
		case 'xlsx':
		case 'xlsm':
		case 'xlam':
		case 'xlsb':
		case 'ods': return write_zip_type(wb, o);
		default: throw new Error ("Unrecognized bookType |" + o.bookType + "|");
	}
}

function resolve_book_type(o/*:WriteFileOpts*/) {
	if(o.bookType) return;
	var _BT = {
		"xls": "biff8",
		"htm": "html",
		"slk": "sylk",
		"socialcalc": "eth",
		"Sh33tJS": "WTF"
	};
	var ext = o.file.slice(o.file.lastIndexOf(".")).toLowerCase();
	if(ext.match(/^\.[a-z]+$/)) o.bookType = ext.slice(1);
	o.bookType = _BT[o.bookType] || o.bookType;
}

function writeFileSync(wb/*:Workbook*/, filename/*:string*/, opts/*:?WriteFileOpts*/) {
	var o = opts||{}; o.type = 'file';
	o.file = filename;
	resolve_book_type(o);
	return writeSync(wb, o);
}

function writeFileSyncXLSX(wb/*:Workbook*/, filename/*:string*/, opts/*:?WriteFileOpts*/) {
	var o = opts||{}; o.type = 'file';
	o.file = filename;
	resolve_book_type(o);
	return writeSyncXLSX(wb, o);
}


function writeFileAsync(filename/*:string*/, wb/*:Workbook*/, opts/*:?WriteFileOpts*/, cb/*:?(e?:ErrnoError)=>void*/) {
	var o = opts||{}; o.type = 'file';
	o.file = filename;
	resolve_book_type(o);
	o.type = 'buffer';
	var _cb = cb; if(!(_cb instanceof Function)) _cb = (opts/*:any*/);
	return _fs.writeFile(filename, writeSync(wb, o), _cb);
}
