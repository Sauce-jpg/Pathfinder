
async function loginGoogle() {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${location.origin}/inventory` },
  });
  if (error) alert(error.message);
}

export default function Inventory() {
  return (
    <main style={{ maxWidth: 900, margin: "0 auto", padding: "2rem" }}>
      <h1>Inventory</h1>
      <p>Coming next: Supabase-backed inventory with login + edit + sync.</p>

      <button onClick={loginGoogle}>Sign in with Google</button>
    </main>
  );
}
