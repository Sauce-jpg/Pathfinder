import styles from "../inventory.module.css";
import { humanKey, safeText } from "../helpers";

function slugifySpecId(key: string) {
  return (
    "spec-" +
    String(key)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
  );
}

function renderKVTable(obj: Record<string, any>) {
  const rows = Object.entries(obj).map(([k, v]) => {
    const val =
      v && typeof v === "object" ? JSON.stringify(v) : safeText(v);
    return (
      <tr key={k}>
        <td className={styles.specK}>{humanKey(k)}</td>
        <td className={styles.specV}>{val}</td>
      </tr>
    );
  });

  return (
    <table className={styles.specTable}>
      <tbody>{rows}</tbody>
    </table>
  );
}

type Props = {
  specs: any;
};

export function Specs({ specs }: Props) {
  if (!specs || typeof specs !== "object") return null;

  const entries = Object.entries(specs).filter(
    ([_, v]) => v != null && v !== ""
  );
  if (!entries.length) return null;

  const toc = entries
    .map(([sectionKey, sectionVal]) => {
      const hasContent =
        typeof sectionVal !== "object"
          ? true
          : Object.keys(sectionVal || {}).length > 0;
      if (!hasContent) return null;
      const id = slugifySpecId(sectionKey);
      return (
        <a key={sectionKey} className={styles.specTocLink} href={`#${id}`}>
          {humanKey(sectionKey)}
        </a>
      );
    })
    .filter(Boolean);

  return (
    <>
      {!!toc.length && (
        <div className={styles.specToc}>
          <div className={styles.specTocTitle}>Specs</div>
          <div className={styles.specTocLinks}>{toc}</div>
        </div>
      )}

      <div>
        {entries.map(([sectionKey, sectionVal]) => {
          const id = slugifySpecId(sectionKey);
          if (typeof sectionVal !== "object") {
            return (
              <div key={sectionKey}>
                <h4 id={id} className={styles.specSectionTitle}>
                  {humanKey(sectionKey)}
                </h4>
                {renderKVTable({ value: sectionVal })}
              </div>
            );
          }
          return (
            <div key={sectionKey}>
              <h4 id={id} className={styles.specSectionTitle}>
                {humanKey(sectionKey)}
              </h4>
              {renderKVTable(sectionVal || {})}
            </div>
          );
        })}
      </div>
    </>
  );
}
