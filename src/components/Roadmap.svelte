<!-- Roadmap.svelte -->
<script>
  import { onMount } from 'svelte';
  import { fade } from 'svelte/transition';

  const VOTES_ENDPOINT = import.meta.env.VITE_VOTES_ENDPOINT;

  let epics = [];
  let loading = false;
  let votingLoading = false;
  let error = null;
  let activeTab = 'all';

  // Função para obter o userId do cookie
  function getUserIdFromCookie() {
    const cookies = document.cookie.split(';');
    const userIdCookie = cookies.find(cookie => cookie.trim().startsWith('roadmap_user_id='));
    return userIdCookie ? userIdCookie.split('=')[1].trim() : null;
  }

  // Função para salvar o userId no cookie (válido por 1 ano)
  function saveUserIdToCookie(id) {
    const oneYear = 365 * 24 * 60 * 60 * 1000;
    const expires = new Date(Date.now() + oneYear).toUTCString();
    document.cookie = `roadmap_user_id=${id};expires=${expires};path=/`;
  }

  // Inicializa o userId de forma consistente
  let userId = localStorage.getItem('roadmap_user_id') || getUserIdFromCookie();
  
  if (!userId) {
    userId = crypto.randomUUID();
    localStorage.setItem('roadmap_user_id', userId);
    saveUserIdToCookie(userId);
    console.log('Novo User ID criado:', userId);
  } else {
    // Garante que o ID está salvo em ambos os lugares
    localStorage.setItem('roadmap_user_id', userId);
    saveUserIdToCookie(userId);
    console.log('User ID existente:', userId);
  }

  // Debug: Monitora mudanças no userId
  $: {
    console.log('Estado atual do userId:', userId);
    console.log('localStorage userId:', localStorage.getItem('roadmap_user_id'));
    console.log('cookie userId:', getUserIdFromCookie());
  }

  const statusCategories = {
    'To Do': 'planned',
    'In Progress': 'in-progress',
    'Done': 'done'
  };

  const tabs = [
    { id: 'all', label: 'All' },
    { id: 'planned', label: 'Planned' },
    { id: 'wip', label: 'Work in Progress' },
    { id: 'done', label: 'Done' }
  ];

  onMount(async () => {
    await fetchEpics();
  });

  async function fetchEpics() {
    try {
      loading = true;
      error = null;
      
      // Busca os épicos do Jira
      const response = await fetch(import.meta.env.VITE_N8N_ENDPOINT);
      if (!response.ok) {
        throw new Error('Failed to fetch epics');
      }
      const data = await response.json();
      
      // Busca os votos
      const votesResponse = await fetch(VOTES_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          action: 'get_votes'
        })
      });

      if (!votesResponse.ok) {
        throw new Error('Failed to fetch votes');
      }

      const votesResult = await votesResponse.json();
      console.log('Resposta dos votos:', votesResult);

      // Processa os votos
      const votesCount = {};
      const userVotes = new Set();

      votesResult.forEach(vote => {
        // Conta total de votos por epic
        if (!votesCount[vote.epic_id]) {
          votesCount[vote.epic_id] = 0;
        }
        votesCount[vote.epic_id]++;

        // Marca os votos do usuário atual
        if (vote.user_id === userId) {
          userVotes.add(vote.epic_id);
        }
      });

      epics = data.map(issue => ({
        id: issue.id,
        key: issue.key,
        summary: issue.fields.summary,
        description: issue.fields.description || issue.fields.customfield_10011 || '',
        status: issue.fields.status.name,
        category: statusCategories[issue.fields.status.name] || 'planned',
        votes: votesCount[issue.key] || 0,
        hasVoted: userVotes.has(issue.key)
      }));
      
      // Ordena os épicos por votos e depois por categoria
      epics.sort((a, b) => {
        if (b.votes !== a.votes) return b.votes - a.votes;
        if (a.category !== b.category) return a.category.localeCompare(b.category);
        return a.summary.localeCompare(b.summary);
      });

    } catch (err) {
      console.error('Error loading epics:', err);
      error = err.message;
    } finally {
      loading = false;
    }
  }

  async function handleVote(epic) {
    try {
      if (!userId) {
        console.error('UserId não encontrado');
        error = 'User ID not found. Please refresh the page.';
        return;
      }

      votingLoading = true;
      const action = epic.hasVoted ? 'remove_vote' : 'add_vote';
      
      console.log('Enviando voto:', {
        action,
        epicKey: epic.key,
        userId,
      });

      const response = await fetch(VOTES_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          action,
          epicKey: epic.key,
          userId
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to update vote: ${response.status} ${response.statusText}`);
      }

      // Atualiza o estado local
      epic.hasVoted = !epic.hasVoted;
      epic.votes = epic.votes + (epic.hasVoted ? 1 : -1);

      // Reordena os épicos
      epics = [...epics].sort((a, b) => {
        if (b.votes !== a.votes) return b.votes - a.votes;
        if (a.category !== b.category) return a.category.localeCompare(b.category);
        return a.summary.localeCompare(b.summary);
      });

    } catch (err) {
      console.error('Error voting:', err);
      error = err.message;
    } finally {
      votingLoading = false;
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
      <div class="epics-grid">
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
      </div>
    {:else}
      <div class="epics-grid">
        {#each filteredEpics as epic}
          <div class="roadmap-item">
            <div class="epic-header">
              <h3>{epic.summary}</h3>
              <button 
                class="vote-button" 
                class:voted={epic.hasVoted}
                on:click={() => handleVote(epic)}
                disabled={votingLoading}
                title={epic.hasVoted ? 'Clique para remover seu voto' : 'Clique para votar'}
              >
                <span class="vote-count">{epic.votes}</span>
                <span class="vote-icon">{epic.hasVoted ? '▼' : '▲'}</span>
              </button>
            </div>
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

  .epic-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 12px;
  }

  .epic-header h3 {
    margin: 0;
    flex: 1;
    margin-right: 12px;
  }

  .vote-button {
    display: flex;
    flex-direction: column;
    align-items: center;
    background: transparent;
    border: 1px solid #30304B;
    border-radius: 4px;
    padding: 4px 8px;
    cursor: pointer;
    color: #A0A0B0;
    transition: all 0.2s ease;
    position: relative;
  }

  .vote-button:hover {
    border-color: #B1754A;
    color: #FFFFFF;
  }

  .vote-button.voted {
    background-color: #B1754A;
    border-color: #B1754A;
    color: #FFFFFF;
  }

  .vote-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .vote-count {
    font-size: 14px;
    font-weight: 500;
    margin-bottom: 2px;
  }

  .vote-icon {
    font-size: 12px;
  }

  .vote-status {
    font-size: 12px;
    color: #B1754A;
    margin-top: 8px;
    font-style: italic;
  }
</style> 