import org.apache.lucene.index.*;
import org.apache.lucene.store.*;
import org.apache.lucene.document.*;
import java.nio.file.*;
import java.io.*;
public class Dump {
  public static void main(String[] a) throws Exception {
    try (DirectoryReader r = DirectoryReader.open(FSDirectory.open(Paths.get(a[0])));
         PrintWriter out = new PrintWriter(new BufferedWriter(new OutputStreamWriter(new FileOutputStream(a[1]), "UTF-8")))) {
      StoredFields sf = r.storedFields();
      int limit = a.length > 2 ? Integer.parseInt(a[2]) : Integer.MAX_VALUE;
      for (int i = 0; i < r.maxDoc() && i < limit; i++) {
        Document d = sf.document(i);
        StringBuilder sb = new StringBuilder("{");
        boolean first = true;
        for (IndexableField f : d.getFields()) {
          String v = f.stringValue(); if (v == null) continue;
          if (!first) sb.append(","); first = false;
          sb.append('"').append(f.name().replace("\"","")).append("\":\"").append(v.replace("\\","\\\\").replace("\"","\\\"").replace("\n"," ").replace("\r"," ").replace("\t"," ")).append('"');
        }
        out.println(sb.append("}"));
      }
      System.out.println(a[0] + " docs=" + r.maxDoc());
    }
  }
}
