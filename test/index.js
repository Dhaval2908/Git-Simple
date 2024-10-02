const express = require('express');
const axios = require('axios');
const { marked } = require('marked');
const path = require('path');

const app = express();
const GITHUB_USERNAME = 'Dhaval2908'; // Your GitHub username
const GITHUB_API_URL = `https://api.github.com/repos/${GITHUB_USERNAME}`;

// Set EJS as the view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware to serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Fetch repo contents recursively
async function fetchRepoContents(repoName, folderPath = '') {
    const repoUrl = `${GITHUB_API_URL}/${repoName}/contents/${folderPath}`;
    const response = await axios.get(repoUrl);
    
    if (response.status !== 200) {
        throw new Error('Failed to fetch contents');
    }

    const contents = response.data;

    const files = [];
    const directories = [];

    for (const item of contents) {
        if (item.type === 'dir') {
            const subdirectoryPath = folderPath ? `${folderPath}/${item.name}` : item.name;
            directories.push({ name: item.name, path: subdirectoryPath, subdirectories: await fetchRepoContents(repoName, subdirectoryPath) });
        } else if (item.type === 'file') {
            files.push(item);
        }
    }

    return { files, directories };
}


// Route for Home Page - Display all GitHub Repos
app.get('/', async (req, res) => {
    try {
        const response = await axios.get(`https://api.github.com/users/${GITHUB_USERNAME}/repos`);
        const repos = response.data;
        res.render('index', { repos, GITHUB_USERNAME });
    } catch (error) {
        console.error('Error fetching repos:', error);
        res.status(500).send('Failed to fetch repositories from GitHub');
    }
});

// Route to display repository content (recursive)
app.get('/repos/:repoName', async (req, res) => {
    const { repoName } = req.params; // Correctly capturing the repoName from the URL
    const folderPath = req.params[0] || ''; // Capture any subfolder path

    console.log(`Fetching contents for repo: ${repoName}, folder: ${folderPath}`); // Debugging log

    try {
        const { files, directories } = await fetchRepoContents(repoName, folderPath);

        const fileContents = {};
        for (const file of files) {
            const fileContent = await axios.get(file.download_url);
            if (file.name.endsWith('.md')) {
                fileContents[file.name] = marked(fileContent.data); // Convert Markdown to HTML
            } else {
                fileContents[file.name] = fileContent.data; // For non-markdown files
            }
        }

        res.render('repo', {
            repoName,
            folderPath,
            directories,
            files,
            fileContents
        });
    } catch (error) {
        console.error('Error fetching repository contents:', error.message);
        res.status(404).send(`Repository or content not found for ${repoName}. Please check the repository name and try again.`);
    }
});
// Route to serve file content
app.get('/repos/:repoName/:fileName', async (req, res) => {
    const { repoName, fileName } = req.params;

    try {
        const { files, directories } = await fetchRepoContents(repoName);
        const file = files.find(f => f.name === fileName);

        if (!file) {
            return res.status(404).send('File not found');
        }

        const fileContent = await axios.get(file.download_url);
        const content = file.name.endsWith('.md') ? marked(fileContent.data) : fileContent.data;

        res.send(content);
    } catch (error) {
        console.error('Error fetching file content:', error.message);
        res.status(500).send('Error fetching file content');
    }
});


// Start the server
const port = process.env.PORT || 3000;
app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});
