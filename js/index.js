const WP_URL = "https://dev-blog-app.pantheonsite.io/wp-json/wp/v2/posts";

// 1. Get Auth from storage (if it exists)
let AUTH = localStorage.getItem("user_auth") || null;

async function handleLogin() {
  const user = document.getElementById("login-user").value;
  const pass = document.getElementById("login-pass").value;

  if (!user || !pass) {
    alert("Please enter both credentials");
    return;
  }

  const encoded = btoa(`${user}:${pass}`);
  const tempAuth = `Basic ${encoded}`;

  try {
    // We test the credentials against the /users/me endpoint
    const resp = await fetch(
      "https://dev-blog-app.pantheonsite.io/wp-json/wp/v2/users/me",
      {
        headers: { Authorization: tempAuth },
      },
    );

    if (resp.ok) {
      // SUCCESS PATH
      AUTH = tempAuth;
      localStorage.setItem("user_auth", tempAuth);

      alert("Login Successful!");

      // 1. Hide the modal immediately
      document.getElementById("login-modal").style.display = "none";

      // 2. Update the UI buttons (+ and Logout)
      updateUIForAuth();

      return; // STOP the function here so it doesn't hit the catch block
    } else {
      alert(
        "Login failed. Check your WordPress Application Username and Password.",
      );
    }
  } catch (err) {
    console.error("Login Error:", err);
    // This only fires if the server is actually down (Connection Error)
    alert("Connection error. Is your local XAMPP/Apache server running?");
  }
}

// 3. UI Protection Logic
function updateUIForAuth() {
  const createBtn = document.getElementById("showCreateForm");
  const authBtn = document.getElementById("authTrigger");

  if (AUTH) {
    createBtn.style.display = "block"; // Show the '+' button
    authBtn.innerText = "Logout";
    authBtn.onclick = handleLogout;
  } else {
    createBtn.style.display = "none"; // Hide '+' button
    authBtn.innerText = "Login";
    authBtn.onclick = () =>
      (document.getElementById("login-modal").style.display = "flex");
  }
  fetchPosts(); // Re-render posts to show/hide Edit/Delete buttons
}

function handleLogout() {
  localStorage.removeItem("user_auth");
  AUTH = null;
  updateUIForAuth();
}

async function fetchPosts() {
  const container = document.getElementById("posts-container");
  container.innerHTML = "Checking connection..."; // Step 1 visible

  try {
    console.log("Attempting to connect to: ", WP_URL);
    // Adding ?_cb=${Date.now()} makes every request unique so the server can't use a cache
    const urlWithCacheBuster = `${WP_URL}?_cb=${Date.now()}`;

    const response = await fetch(urlWithCacheBuster);

    if (!response.ok) {
      throw new Error(`Server responded with ${response.status}`);
    }

    const posts = await response.json();
    console.log("Posts received: ", posts); // Step 2 visible in console

    if (posts.length === 0) {
      container.innerHTML = "Connected! But you have 0 posts in WordPress.";
    } else {
      renderPosts(posts);
    }
  } catch (err) {
    console.error("Connection failed:", err);
    container.innerHTML =
      "Error: " + err.message + ". Check console for details.";
  }
}

function renderPosts(posts) {
  const container = document.getElementById("posts-container");

  // Handle empty state
  if (!posts || posts.length === 0) {
    container.innerHTML = `<p class="no-posts">No posts found. Start writing!</p>`;
    return;
  }

  container.innerHTML = posts
    .map((post) => {
      // 1. Format the date
      const postDate = new Date(post.date).toLocaleDateString();

      // 2. Prepare data for the Edit Modal
      const plainTextContent = post.content.rendered.replace(/<[^>]*>/g, "");
      const encodedContent = encodeURIComponent(plainTextContent);
      const safeTitle = post.title.rendered.replace(/'/g, "&apos;");

      // 3. Authentication Check: Only show buttons if AUTH_HEADER exists
      // This is the "Software Engineer" touch for API security
      const adminActions = AUTH
        ? `
        <div class="post-actions">
          <button class="btn-edit" onclick="editPost(${post.id}, '${safeTitle}', '${encodedContent}')">
            <i class="fa-solid fa-pen"></i> Edit
          </button>
          
          <button class="btn-delete" onclick="deletePost(${post.id})">
            <i class="fa-solid fa-trash"></i> Delete
          </button>
        </div>
    `
        : "";

      return `
      <article class="post-card" id="post-${post.id}">
        <div class="post-content">
          <span class="post-date">${postDate}</span>
          <h2 class="post-title">${post.title.rendered}</h2>
          <div class="post-excerpt">${post.excerpt.rendered}</div>
        </div>
        
        ${adminActions}
      </article>
    `;
    })
    .join("");
}

// This makes sure the app starts as soon as the page is ready
window.onload = function () {
  console.log("App started, fetching posts...");
  fetchPosts();
};

// --- Save Function (Handles both Create & Update) ---
async function savePost() {
  const id = document.getElementById("edit-post-id").value;
  const title = document.getElementById("post-title").value;
  const content = document.getElementById("post-body").value;

  if (!title || !content) {
    alert("Please fill in both title and content");
    return;
  }

  // Toggle endpoint and method based on whether an ID exists
  const endpoint = id ? `${WP_URL}/${id}` : `${WP_URL}`;
  const method = id ? "PUT" : "POST";

  try {
    const response = await fetch(endpoint, {
      method: method,
      headers: {
        "Content-Type": "application/json",
        Authorization: AUTH, // Double-check this variable name at the top of your file
      },
      body: JSON.stringify({
        title: title,
        content: content,
        status: "publish",
      }),
    });

    if (response.ok) {
      alert(id ? "Post updated successfully!" : "New post created!");
      closeModal();
      fetchPosts(); // Refresh the list to show changes
    } else {
      const err = await response.json();
      alert("Error: " + err.message);
    }
  } catch (error) {
    console.error("Save error:", error);
    alert("Connection error. Check if WordPress is running.");
  }
}

// --- Edit Post (Modified to handle content) ---
function editPost(id, title, contentEncoded) {
  const modal = document.getElementById("post-modal");
  const modalTitle = document.getElementById("modal-title");

  modalTitle.innerText = "Edit Post";
  document.getElementById("edit-post-id").value = id;
  document.getElementById("post-title").value = title;

  // Decodes the content back to normal text for the textarea
  document.getElementById("post-body").value =
    decodeURIComponent(contentEncoded);

  modal.style.display = "flex";
}

// --- Delete Post (Kept your logic, fixed the Auth variable) ---
async function deletePost(id) {
  if (!confirm("Are you sure you want to delete this post?")) return;

  const response = await fetch(`${WP_URL}/${id}`, {
    method: "DELETE",
    headers: {
      Authorization: AUTH,
    },
  });

  if (response.ok) {
    fetchPosts();
  } else {
    const err = await response.json();
    alert("Delete failed: " + err.message);
  }
}

// --- Utilities ---
document.getElementById("showCreateForm").onclick = function () {
  document.getElementById("modal-title").innerText = "New Post";
  document.getElementById("edit-post-id").value = "";
  document.getElementById("post-title").value = "";
  document.getElementById("post-body").value = "";
  document.getElementById("post-modal").style.display = "flex";
};

function closeModal() {
  document.getElementById("post-modal").style.display = "none";
}

document.getElementById("closeModal").onclick = closeModal;
document.getElementById("savePost").onclick = savePost;

// Start the app
window.onload = () => {
  updateUIForAuth();
};

// Bind the login button
document.getElementById("performLogin").onclick = handleLogin;
document.getElementById("closeLogin").onclick = () => {
  document.getElementById("login-modal").style.display = "none";
};
