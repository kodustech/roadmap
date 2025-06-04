<!-- Roadmap.svelte -->
<script>
  import { onMount } from 'svelte';

  let epics = [];
  let activeTab = 'all';
  let loading = true;
  let error = null;

  const tabs = [
    { id: 'all', label: 'All' },
    { id: 'planned', label: 'Planned' },
    { id: 'wip', label: 'Work in Progress' },
    { id: 'done', label: 'Done' }
  ];

  // Mapeamento dos status do Jira para nossas categorias
  const statusCategories = {
    'Backlog': 'planned',
    'IDEAS': 'planned',
    'READY TO DO': 'planned',
    'READY TO REFINEMENT': 'planned',
    'IN REFINEMENT': 'planned',
    'IN DESIGN (UX/UI)': 'wip',
    'IN HOMOLOG': 'wip',
    'EM ANDAMENTO': 'wip',
    'WAITING FOR HOMOLOG': 'wip',
    'READY TO DEPLOY': 'done'
  };

  async function fetchEpics() {
    try {
      loading = true;
      error = null;
      
      const response = await fetch(import.meta.env.VITE_N8N_ENDPOINT);

      if (!response.ok) {
        throw new Error(`Request error: ${response.status} ${response.statusText}`);
      }

      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error('Invalid server response. Please check if the N8N URL is correct.');
      }

      const data = await response.json();
      console.log('Dados brutos do Jira:', data);
      
      const issues = Array.isArray(data) ? data : [data];
      
      // Log para ver os status que estão vindo
      const statusList = issues.map(issue => issue.fields.status.name);
      console.log('Status que vieram do Jira:', [...new Set(statusList)]);
      
      epics = issues.map(issue => ({
        id: issue.id,
        key: issue.key,
        summary: issue.fields.summary,
        description: issue.fields.description || issue.fields.customfield_10011 || '',
        status: issue.fields.status.name, // Nome do status do Jira
        category: statusCategories[issue.fields.status.name] || 'planned' // Categoria mapeada
      }));
      
      epics.sort((a, b) => {
        if (a.category !== b.category) {
          return a.category.localeCompare(b.category);
        }
        return a.summary.localeCompare(b.summary);
      });

      console.log('Epics mapeados:', epics);
    } catch (err) {
      console.error('Error loading epics:', err);
      
      if (err.message.includes('Failed to fetch') || err.message.includes('NetworkError')) {
        error = 'Could not connect to server. Please check your connection and N8N URL.';
      } else if (err.message.includes('JSON')) {
        error = 'Invalid server response. Please check if the N8N URL is correct.';
      } else {
        error = err.message;
      }
    } finally {
      loading = false;
    }
  }

  function getFilteredEpics(tab) {
    switch (tab) {
      case 'all':
        return epics;
      case 'planned':
        return epics.filter(epic => epic.category === 'planned');
      case 'wip':
        return epics.filter(epic => epic.category === 'wip');
      case 'done':
        return epics.filter(epic => epic.category === 'done');
      default:
        return [];
    }
  }

  onMount(fetchEpics);

  $: filteredEpics = getFilteredEpics(activeTab);
</script>

<div class="roadmap-container">
  <header class="roadmap-header">
    <nav class="roadmap-tabs">
      {#each tabs as tab}
        <button
          class="tab-button"
          class:active={activeTab === tab.id}
          on:click={() => activeTab = tab.id}
        >
          {tab.label}
        </button>
      {/each}
    </nav>
  </header>

  <main class="roadmap-content">
    {#if loading}
      <div class="message loading">Loading epics...</div>
    {:else if error}
      <div class="message error">{error}</div>
    {:else if filteredEpics.length === 0}
      <div class="message empty">
        {#if activeTab === 'all'}
          No epics found.
        {:else if activeTab === 'planned'}
          No epics planned at the moment.
        {:else if activeTab === 'wip'}
          No epics in work in progress at the moment.
        {:else}
          No epics done at the moment.
        {/if}
      </div>
    {:else}
      <div class="epics-grid">
        {#each filteredEpics as epic}
          <div class="roadmap-item">
            <h3>{epic.summary}</h3>
            <p class="description">{epic.description || 'No description available'}</p>
          </div>
        {/each}
      </div>
    {/if}
  </main>
</div>

<style>
  .roadmap-container {
    width: 100%;
    height: 100vh;
    display: flex;
    flex-direction: column;
    background-color: #181825;
  }

  .roadmap-header {
    margin-bottom: 0;
    border-bottom: 1px solid #30304B;
    padding: 0 20px;
  }

  .roadmap-tabs {
    display: flex;
    gap: 0.5rem;
  }

  .tab-button {
    background-color: transparent;
    color: #A0A0B0;
    border: none;
    padding: 15px 25px;
    font-size: 16px;
    cursor: pointer;
    position: relative;
    transition: color 0.3s ease;
    font-weight: 400;
  }

  .tab-button:hover {
    color: #FFFFFF;
  }

  .tab-button.active {
    color: #FFFFFF;
    font-weight: 500;
  }

  .tab-button.active::after {
    content: '';
    position: absolute;
    bottom: -1px;
    left: 0;
    width: 100%;
    height: 3px;
    background-color: #B1754A;
  }

  .roadmap-content {
    flex: 1;
    overflow-y: auto;
    padding: 20px;
  }

  .epics-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 20px;
    max-width: 1200px;
    margin: 0 auto;
  }

  .roadmap-item {
    background-color: #202032;
    border: 1px solid #30304B;
    border-radius: 8px;
    padding: 20px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    transition: transform 0.2s ease-in-out;
    text-align: left;
  }

  .roadmap-item:hover {
    transform: translateY(-2px);
  }

  .roadmap-item h3 {
    font-size: 18px;
    color: #FFFFFF;
    margin: 0 0 12px 0;
    font-weight: 500;
    line-height: 1.4;
  }

  .description {
    font-size: 14px;
    color: #B0B0C0;
    line-height: 1.6;
    margin: 0;
    font-weight: 400;
  }

  .message {
    text-align: center;
    padding: 40px 20px;
    color: #A0A0B0;
    grid-column: 1 / -1;
    font-weight: 400;
  }

  .message.error {
    color: #FF6B6B;
  }

  @media (max-width: 600px) {
    .roadmap-header {
      padding: 0 10px;
    }

    .roadmap-content {
      padding: 10px;
    }

    .epics-grid {
      grid-template-columns: 1fr;
    }

    .tab-button {
      padding: 12px 15px;
      font-size: 14px;
    }
  }

  :global(body) {
    margin: 0;
    padding: 0;
    background-color: #181825;
  }
</style> 