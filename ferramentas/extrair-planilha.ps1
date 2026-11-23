param([string]$dir, [string]$out)
$code = @"
using System; using System.IO; using System.Text; using System.Xml; using System.Collections.Generic;
public static class XDump {
  const string M = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
  static string Txt(XmlReader r, string endName) {
    // read text of all <t> inside current element until its end
    var sb = new StringBuilder(); int depth = r.Depth;
    if (r.IsEmptyElement) return "";
    while (r.Read()) {
      if (r.NodeType == XmlNodeType.EndElement && r.Depth == depth) break;
      if (r.NodeType == XmlNodeType.Element && r.LocalName == "t") sb.Append(r.ReadElementContentAsString());
      if (r.NodeType == XmlNodeType.Element && r.LocalName == "t") { }
    }
    return sb.ToString();
  }
  public static List<string> Strings(string path) {
    var l = new List<string>(); if (!File.Exists(path)) return l;
    using (var r = XmlReader.Create(path)) {
      while (r.Read()) if (r.NodeType == XmlNodeType.Element && r.LocalName == "si") {
        var sb = new StringBuilder(); int d = r.Depth;
        if (!r.IsEmptyElement) {
          while (r.Read()) {
            if (r.NodeType == XmlNodeType.EndElement && r.Depth == d) break;
            if (r.NodeType == XmlNodeType.Element && r.LocalName == "rPh") { r.Skip(); continue; }
            while (r.NodeType == XmlNodeType.Element && r.LocalName == "t") { sb.Append(r.ReadElementContentAsString()); }
            if (r.NodeType == XmlNodeType.EndElement && r.Depth == d) break;
          }
        }
        l.Add(sb.ToString());
      }
    }
    return l;
  }
  public static string Sheet(string path, List<string> ss) {
    var o = new StringBuilder(); var merges = new List<string>(); var row = new List<string>();
    using (var r = XmlReader.Create(path)) {
      string cref = null, ctype = null, val = null, f = null; bool inC = false;
      while (r.Read()) {
        if (r.NodeType == XmlNodeType.Element) {
          switch (r.LocalName) {
            case "row": if (row.Count > 0) { o.AppendLine(string.Join(" | ", row)); row.Clear(); } break;
            case "c": cref = r.GetAttribute("r"); ctype = r.GetAttribute("t"); val = null; f = null; inC = !r.IsEmptyElement; break;
            case "v": if (inC) val = r.ReadElementContentAsString(); break;
            case "f": if (inC) f = r.IsEmptyElement ? "(shared)" : r.ReadElementContentAsString(); break;
            case "is": if (inC) { val = ""; int d = r.Depth; while (r.Read()) { if (r.NodeType == XmlNodeType.EndElement && r.Depth == d) break; if (r.NodeType == XmlNodeType.Element && r.LocalName == "t") val += r.ReadElementContentAsString(); } } break;
            case "mergeCell": merges.Add(r.GetAttribute("ref")); break;
            case "dataValidation": o.AppendLine("VALIDATION " + r.GetAttribute("sqref") + " type=" + r.GetAttribute("type")); break;
            case "formula1": o.AppendLine("  formula1: " + r.ReadElementContentAsString()); break;
          }
        }
        if (r.NodeType == XmlNodeType.EndElement && r.LocalName == "c") {
          inC = false; string v = val;
          if (ctype == "s" && v != null) v = ss[int.Parse(v)];
          if (f != null) v = (v ?? "") + " {=" + f + "}";
          if (v != null && v.Trim() != "") row.Add("[" + cref + "] " + v.Replace("\r", "").Replace("\n", " / "));
        }
      }
      if (row.Count > 0) o.AppendLine(string.Join(" | ", row));
    }
    if (merges.Count > 0) o.AppendLine("MERGES: " + string.Join(" ", merges));
    return o.ToString();
  }
}
"@
if (-not ([System.Management.Automation.PSTypeName]'XDump').Type) { Add-Type -TypeDefinition $code -ReferencedAssemblies System.Xml }
$ss = [XDump]::Strings((Join-Path $dir 'xl\sharedStrings.xml'))
[xml]$wb = Get-Content -Raw -Encoding UTF8 (Join-Path $dir 'xl\workbook.xml')
[xml]$rels = Get-Content -Raw -Encoding UTF8 (Join-Path $dir 'xl\_rels\workbook.xml.rels')
$sb = New-Object System.Text.StringBuilder
foreach ($sh in $wb.workbook.sheets.sheet) {
  $rid = $sh.GetAttribute('id', 'http://schemas.openxmlformats.org/officeDocument/2006/relationships')
  $target = ($rels.Relationships.Relationship | Where-Object { $_.Id -eq $rid }).Target
  $path = Join-Path $dir ('xl\' + $target.Replace('/', '\'))
  [void]$sb.AppendLine("################ SHEET: $($sh.name)  ($target) state=$($sh.state)")
  [void]$sb.AppendLine([XDump]::Sheet($path, $ss))
}
if ($wb.workbook.definedNames) { foreach ($n in $wb.workbook.definedNames.definedName) { [void]$sb.AppendLine("NAME $($n.name) = $($n.'#text')") } }
[System.IO.File]::WriteAllText($out, $sb.ToString(), [System.Text.Encoding]::UTF8)
