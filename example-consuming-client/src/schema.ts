const schema = `
  fragment info on Info {
    count
    pages
    next
    prev
  }

  fragment location on Location {
    id
    name
    # type
    # dimension
    # created
  }

  fragment character on Character {
    id
    name
    origin {
      ...location
    }
    # status
    # species
    # type
    # gender
    # location {
    #   ...location
    # }
    # image
    # episode {
    #   ...episode
    # }
    # created
  }

  fragment episode on Episode {
    id
    name
    air_date
    episode
    created
    characters {
      ...character
    }
  }

  # "id": "1"
  query GetCharacterById($id: ID!) {
    character(id: $id) {
      ...character
    }
  }

  query GetCharacters {
    characters {
      info {
        ...info
      }
      results {
        ...character
      }
    }
  }

  # "id": "1"
  query GetLocationById($id: ID!) {
    location(id: $id) {
      ...location
    }
  }

  query GetLocations {
    locations {
      info {
        ...info
      }
      results {
        ...location
      }
    }
  }

  # "id": "1"
  query GetEpisodeById($id: ID!) {
    episode(id: $id) {
      ...episode
    }
  }

  query GetEpisodes {
    episodes {
      info {
        ...info
      }
      results {
        ...episode
      }
    }
  }
`;

export default schema;

