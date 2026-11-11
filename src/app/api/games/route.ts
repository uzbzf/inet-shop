import { NextResponse } from 'next/server';
import { INITIAL_GAMES } from '@/data/games';
import { Game } from '@/types';
import { getDbGames, insertDbGame, deleteDbGame } from '@/lib/neon-db';

let memoryGamesStore: Game[] = [...INITIAL_GAMES];

export async function GET() {
  try {
    const dbGames = await getDbGames();
    if (dbGames !== null && dbGames.length > 0) {
      return NextResponse.json({ success: true, games: dbGames, source: 'neon_postgres' });
    }
  } catch (err) {
    console.warn('Neon Postgres games fetch error, falling back to memory store:', err);
  }

  return NextResponse.json({ success: true, games: memoryGamesStore, source: 'memory' });
}

export async function POST(req: Request) {
  try {
    const game = (await req.json()) as Game;
    if (!game.id) {
      game.id = game.title.toLowerCase().replace(/[^a-z0-9]/g, '-');
    }
    memoryGamesStore.unshift(game);

    try {
      await insertDbGame(game);
    } catch (err) {
      console.warn('Failed to insert game into Neon DB:', err);
    }

    return NextResponse.json({ success: true, game });
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, message: errorMsg }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const game = (await req.json()) as Game;
    const index = memoryGamesStore.findIndex((g) => g.id === game.id);
    if (index !== -1) {
      memoryGamesStore[index] = game;
    }

    try {
      await insertDbGame(game);
    } catch (err) {
      console.warn('Failed to update game in Neon DB:', err);
    }

    return NextResponse.json({ success: true, game });
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, message: errorMsg }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ success: false, message: 'Missing game ID' }, { status: 400 });
    }
    memoryGamesStore = memoryGamesStore.filter((g) => g.id !== id);

    try {
      await deleteDbGame(id);
    } catch (err) {
      console.warn('Failed to delete game from Neon DB:', err);
    }

    return NextResponse.json({ success: true, deletedId: id });
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, message: errorMsg }, { status: 500 });
  }
}
